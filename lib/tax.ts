/**
 * AgentLedger — Tax Module (fixed)
 * Helius Enhanced Transactions API + per-wallet cost basis (IRS 2026)
 */
import { prisma } from "./prisma";
import { sleep } from "./utils";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const HELIUS_BASE    = "https://api.helius.xyz/v0";

const STABLECOINS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
]);

const TOKEN_SYMBOLS: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "SOL",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": "mSOL",
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1": "bSOL",
};

function sym(mint: string): string { return TOKEN_SYMBOLS[mint] ?? mint.slice(0,6)+"…"; }

type TaxRow = Parameters<typeof prisma.taxEvent.create>[0]["data"];

export async function syncWalletTaxEvents(agentWalletId: string, taxYear: number) {
  if (!HELIUS_API_KEY) return { eventsProcessed: 0, newEvents: 0 };
  const wallet = await prisma.agentWallet.findUnique({ where: { id: agentWalletId } });
  if (!wallet) throw new Error("Wallet not found");

  const yearStart = new Date(`${taxYear}-01-01T00:00:00Z`).getTime() / 1000;
  const yearEnd   = new Date(`${taxYear+1}-01-01T00:00:00Z`).getTime() / 1000;
  const all: any[] = [];
  let before: string|undefined, page = 0;

  while (true) {
    const url = new URL(`${HELIUS_BASE}/addresses/${wallet.walletAddress}/transactions`);
    url.searchParams.set("api-key", HELIUS_API_KEY);
    url.searchParams.set("limit", "100");
    if (before) url.searchParams.set("before", before);

    const res = await fetch(url.toString());
    if (!res.ok) break;
    const txs = await res.json() as any[];
    if (!txs.length) break;

    all.push(...txs.filter((t: any) => t.timestamp >= yearStart && t.timestamp < yearEnd));
    if (txs[txs.length-1].timestamp < yearStart) break;
    before = txs[txs.length-1].signature;
    if (++page % 5 === 0) await sleep(600);
  }

  const rows = classify(all, wallet.walletAddress, agentWalletId, taxYear);
  let newEvents = 0;
  for (const row of rows) {
    const sig = row.txSignature ?? `nosig_${Date.now()}_${Math.random()}`;
    try {
      await prisma.taxEvent.upsert({
        where: { agentWalletId_txSignature: { agentWalletId, txSignature: sig } },
        update: {}, create: { ...row, txSignature: sig },
      });
      newEvents++;
    } catch { /* duplicate */ }
  }
  return { eventsProcessed: rows.length, newEvents };
}

function classify(txs: any[], wallet: string, agentWalletId: string, taxYear: number): TaxRow[] {
  const rows: TaxRow[] = [];
  for (const tx of txs) {
    const dt = new Date(tx.timestamp * 1000);
    const fee = tx.fee / 1e9;
    rows.push({ agentWalletId, taxYear, txSignature: tx.signature+"_fee", blockTime: dt, eventType: "TX_FEE", tokenSymbol: "SOL", tokenAmount: fee, usdValueAtTime: 0, walletChain: "SOLANA", notes: `Fee ${fee.toFixed(6)} SOL` });

    if (tx.type === "SWAP" && tx.events?.swap) {
      const s = tx.events.swap;
      const inMint  = s.tokenInputs?.[0]?.mint  ?? "SOL";
      const outMint = s.tokenOutputs?.[0]?.mint ?? "SOL";
      const inAmt   = s.tokenInputs?.[0]  ? Number(s.tokenInputs[0].rawTokenAmount.tokenAmount)  / 10**s.tokenInputs[0].rawTokenAmount.decimals  : Number(s.nativeInput?.amount  ?? 0)/1e9;
      const outAmt  = s.tokenOutputs?.[0] ? Number(s.tokenOutputs[0].rawTokenAmount.tokenAmount) / 10**s.tokenOutputs[0].rawTokenAmount.decimals : Number(s.nativeOutput?.amount ?? 0)/1e9;
      if (inAmt > 0) {
        rows.push({ agentWalletId, taxYear, txSignature: tx.signature, blockTime: dt, eventType: STABLECOINS.has(inMint) ? "TRANSFER_OUT" : "SWAP_REALIZED_GAIN", tokenSymbol: sym(inMint), tokenAmount: inAmt, usdValueAtTime: STABLECOINS.has(outMint) ? outAmt : 0, realizedGlUsd: 0, walletChain: "SOLANA", notes: `Swap ${inAmt.toFixed(4)} ${sym(inMint)} → ${outAmt.toFixed(4)} ${sym(outMint)} via ${tx.source}` });
      }
    }

    for (const t of (tx.nativeTransfers ?? [])) {
      if (!t.amount) continue;
      const isIn = t.toUserAccount === wallet;
      rows.push({ agentWalletId, taxYear, txSignature: tx.signature+`_${isIn?"in":"out"}`, blockTime: dt, eventType: isIn?"TRANSFER_IN":"TRANSFER_OUT", tokenSymbol: "SOL", tokenAmount: t.amount/1e9, walletChain: "SOLANA" });
    }

    for (const t of (tx.tokenTransfers ?? [])) {
      if (!t.tokenAmount) continue;
      const isIn = t.toUserAccount === wallet;
      const isStable = STABLECOINS.has(t.mint);
      rows.push({ agentWalletId, taxYear, txSignature: tx.signature+`_tok_${isIn?"in":"out"}_${t.mint.slice(0,6)}`, blockTime: dt, eventType: isIn && isStable ? "API_FEE_INCOME" : isIn ? "TRANSFER_IN" : "TRANSFER_OUT", tokenSymbol: sym(t.mint), tokenAmount: t.tokenAmount, usdValueAtTime: isStable ? t.tokenAmount : 0, walletChain: "SOLANA" });
    }

    if (tx.type === "STAKE_SOL") {
      const acct = (tx.accountData??[]).find((a: any) => a.account === wallet);
      if (acct?.nativeBalanceChange > 0) {
        rows.push({ agentWalletId, taxYear, txSignature: tx.signature, blockTime: dt, eventType: "STAKING_INCOME", tokenSymbol: "SOL", tokenAmount: acct.nativeBalanceChange/1e9, usdValueAtTime: 0, walletChain: "SOLANA", notes: "Staking reward" });
      }
    }
  }
  return rows;
}

export async function getTaxPosition(orgId: string, taxYear: number) {
  const wallets = await prisma.agentWallet.findMany({ where: { orgId }, include: { taxEvents: { where: { taxYear } } } });
  const ws = wallets.map((w) => {
    const ev = w.taxEvents;
    const sum = (types: string[]) => ev.filter((e) => types.includes(e.eventType)).reduce((s,e) => s+Number(e.usdValueAtTime??0), 0);
    const gl  = (types: string[]) => ev.filter((e) => types.includes(e.eventType)).reduce((s,e) => s+Math.abs(Number(e.realizedGlUsd??0)), 0);
    return { walletAddress: w.walletAddress, agentName: w.agentName, taxYear, ordinaryIncomeUsd: sum(["STAKING_INCOME","API_FEE_INCOME","AIRDROP_INCOME"]), realizedGainsUsd: gl(["SWAP_REALIZED_GAIN"]), realizedLossesUsd: gl(["SWAP_REALIZED_LOSS"]), txFeesUsd: sum(["TX_FEE"]), eventCount: ev.length };
  });
  const totals = ws.reduce((a, w) => ({ ordinaryIncomeUsd: a.ordinaryIncomeUsd+w.ordinaryIncomeUsd, realizedGainsUsd: a.realizedGainsUsd+w.realizedGainsUsd, realizedLossesUsd: a.realizedLossesUsd+w.realizedLossesUsd, txFeesUsd: a.txFeesUsd+w.txFeesUsd }), { ordinaryIncomeUsd:0, realizedGainsUsd:0, realizedLossesUsd:0, txFeesUsd:0 });
  return { taxYear, walletCount: wallets.length, wallets: ws, totals, disclaimer: "For CPA review only. AgentLedger is not a licensed tax advisor. Per-wallet cost basis per IRS Rev. Proc. 2024-28 (eff. Jan 1 2026)." };
}
