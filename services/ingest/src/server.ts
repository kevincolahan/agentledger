/**
 * AgentLedger — Ingest Service
 *
 * Standalone Express service for high-volume SDK event ingestion.
 * Self-contained: does not import from the Next.js app root.
 * Deployed as a separate Railway service.
 *
 * Endpoints:
 *   POST /session/start   — open a new audit session
 *   POST /session/events  — batch event ingestion
 *   POST /session/end     — close session, compute Merkle root, anchor on Solana
 *   GET  /health          — health check
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const prisma = new PrismaClient();
const PORT   = process.env.PORT ?? 3001;

// ─── Rate limiting (sliding window, in-memory) ────────────────────────────────

const RL_WINDOW = 60_000;
const RL_MAX    = 1_000; // events per minute per key
const rlStore   = new Map<string, { count: number; resetAt: number }>();

function rateCheck(key: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  let e = rlStore.get(key);
  if (!e || e.resetAt <= now) {
    if (rlStore.size > 5_000) {
      for (const [k, v] of rlStore) { if (v.resetAt < now) rlStore.delete(k); }
    }
    e = { count: 0, resetAt: now + RL_WINDOW };
    rlStore.set(key, e);
  }
  e.count++;
  return { ok: e.count <= RL_MAX, remaining: Math.max(0, RL_MAX - e.count) };
}

// ─── Solana Memo Program anchoring ───────────────────────────────────────────

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function getAnchorKeypair(): Keypair | null {
  const raw = process.env.SOLANA_ANCHOR_PRIVATE_KEY;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  } catch {
    return null;
  }
}

async function anchorMemo(memo: string): Promise<string | null> {
  const keypair = getAnchorKeypair();
  if (!keypair) return null;

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  const conn   = new Connection(rpcUrl, "confirmed");

  const tx = new Transaction().add(
    new TransactionInstruction({
      keys:      [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM,
      data:      Buffer.from(memo, "utf-8"),
    })
  );

  return sendAndConfirmTransaction(conn, tx, [keypair], { commitment: "confirmed" });
}

// ─── Merkle root ──────────────────────────────────────────────────────────────

function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0)
    return crypto.createHash("sha256").update("empty").digest("hex");
  if (hashes.length === 1) return hashes[0];
  const pairs: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const l = hashes[i], r = hashes[i + 1] ?? l;
    pairs.push(crypto.createHash("sha256").update(l + r).digest("hex"));
  }
  return merkleRoot(pairs);
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const header  = req.headers.authorization;
  const wallet  = req.headers["x-agentledger-wallet"] as string | undefined;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }

  const key = header.slice(7);

  // Rate check on the API key
  const rl = rateCheck(key);
  res.setHeader("X-RateLimit-Remaining", rl.remaining);
  if (!rl.ok) {
    return res.status(429).json({ error: "Rate limit exceeded. Max 1,000 events/min per key." });
  }

  // Org-level key check
  let org = await prisma.organization.findFirst({ where: { apiKey: key } });

  if (!org) {
    // Named API key (hashed)
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const named = await prisma.apiKey.findUnique({
      where: { keyHash: hash },
      include: { org: true },
    });
    if (!named || named.revokedAt) {
      return res.status(401).json({ error: "Invalid or revoked API key" });
    }
    await prisma.apiKey.update({ where: { id: named.id }, data: { lastUsed: new Date() } }).catch(() => {});
    org = named.org;
  }

  (req as any).org = org;

  // Verify wallet if provided
  if (wallet) {
    const agent = await prisma.agentWallet.findFirst({
      where: { orgId: org.id, walletAddress: wallet, status: { not: "ARCHIVED" } },
    });
    if (!agent) {
      return res.status(403).json({ error: "Wallet not registered in this organization" });
    }
    (req as any).agent = agent;
  }

  next();
}

// ─── POST /session/start ──────────────────────────────────────────────────────

app.post("/session/start", requireApiKey, async (req, res) => {
  const { agentWalletAddress, framework, startedAt } = req.body as {
    agentWalletAddress?: string;
    framework?: string;
    startedAt?: string;
  };

  const agent = (req as any).agent;
  if (!agent) {
    return res.status(400).json({ error: "x-agentledger-wallet header required" });
  }

  const session = await prisma.auditSession.create({
    data: {
      agentWalletId: agent.id,
      sessionStart: startedAt ? new Date(startedAt) : new Date(),
      status: "OPEN",
    },
  });

  res.json({ sessionId: session.id });
});

// ─── POST /session/events ─────────────────────────────────────────────────────

interface RawEvent {
  eventType: string;
  sequenceNum: number;
  reasoningSummary?: string;
  promptContextHash?: string;
  toolName?: string;
  toolParamsHash?: string;
  txSignature?: string;
  onChainProgram?: string;
  amountUsd?: number;
  createdAt: string;
}

app.post("/session/events", requireApiKey, async (req, res) => {
  const { sessionId, events } = req.body as { sessionId?: string; events?: RawEvent[] };

  if (!sessionId || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "sessionId and events[] required" });
  }
  if (events.length > 100) {
    return res.status(400).json({ error: "Max 100 events per batch" });
  }

  const org = (req as any).org;
  const session = await prisma.auditSession.findFirst({
    where: { id: sessionId, agentWallet: { orgId: org.id } },
  });

  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.status !== "OPEN") return res.status(409).json({ error: "Session is closed" });

  await prisma.auditLogEntry.createMany({
    data: events.map((e) => ({
      sessionId,
      agentWalletId: session.agentWalletId,
      sequenceNum:       e.sequenceNum,
      eventType:         e.eventType as any,
      reasoningSummary:  e.reasoningSummary,
      promptContextHash: e.promptContextHash,
      toolName:          e.toolName,
      toolParamsHash:    e.toolParamsHash,
      txSignature:       e.txSignature,
      onChainProgram:    e.onChainProgram,
      amountUsd:         e.amountUsd,
      createdAt:         new Date(e.createdAt),
    })),
    skipDuplicates: true,
  });

  await prisma.auditSession.update({
    where: { id: sessionId },
    data: { logCount: { increment: events.length } },
  });

  res.json({ accepted: events.length });
});

// ─── POST /session/end ────────────────────────────────────────────────────────

app.post("/session/end", requireApiKey, async (req, res) => {
  const { sessionId, endedAt } = req.body as { sessionId?: string; endedAt?: string };
  const org = (req as any).org;

  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  const session = await prisma.auditSession.findFirst({
    where: { id: sessionId, agentWallet: { orgId: org.id } },
    include: {
      logEntries: {
        orderBy: { sequenceNum: "asc" },
        select: { sequenceNum: true, eventType: true, reasoningSummary: true, txSignature: true, amountUsd: true },
      },
    },
  });

  if (!session) return res.status(404).json({ error: "Session not found" });

  // Idempotent — return existing result if already closed
  if (session.status !== "OPEN") {
    return res.json({ sessionId, merkleRoot: session.merkleRoot, status: session.status });
  }

  // Compute Merkle root over all log entries
  const root = merkleRoot(
    session.logEntries.map((e: any) =>
      crypto.createHash("sha256")
        .update(JSON.stringify({ ...e, sessionId }))
        .digest("hex")
    )
  );

  await prisma.auditSession.update({
    where: { id: sessionId },
    data: {
      sessionEnd: endedAt ? new Date(endedAt) : new Date(),
      merkleRoot: root,
      status: "CLOSED",
    },
  });

  // Anchor on Solana async (non-blocking)
  const memo = `AL:SESSION:v1:${org.id}:${sessionId}:${root}:${session.logCount}`;
  anchorMemo(memo)
    .then(async (txSig) => {
      if (!txSig) return;
      await prisma.auditSession.update({
        where: { id: sessionId },
        data: { onChainAnchorTx: txSig, anchoredAt: new Date(), status: "ANCHORED" },
      });
      console.log(`[ingest] Session ${sessionId} anchored → ${txSig}`);
    })
    .catch((err) => {
      console.error(`[ingest] Anchor failed for session ${sessionId}:`, err);
    });

  res.json({ sessionId, merkleRoot: root, logCount: session.logCount, status: "CLOSED" });
});

// ─── GET /health ──────────────────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  // Quick DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", service: "agentledger-ingest", ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", service: "agentledger-ingest" });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

prisma.$connect().then(() => {
  app.listen(PORT, () => {
    console.log(`[ingest] AgentLedger ingest service :${PORT}`);
    console.log(`[ingest] Solana anchoring: ${getAnchorKeypair() ? "enabled" : "disabled (no key)"}`);
  });
});

process.on("SIGTERM", async () => {
  console.log("[ingest] Shutting down…");
  await prisma.$disconnect();
  process.exit(0);
});
