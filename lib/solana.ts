/**
 * AgentLedger — Solana On-Chain Anchoring
 *
 * Uses the Solana Memo Program to write content hashes on-chain.
 * Each anchor tx costs ~$0.00025 and provides tamper-proof proof
 * that a record existed at a given slot/time.
 *
 * Two anchor types:
 *   AUTH:    anchor(orgId, agentWalletId, authVersion, recordHash)
 *   SESSION: anchor(orgId, agentWalletId, sessionId, merkleRoot)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import crypto from "crypto";

// Solana Memo Program ID — no need to deploy anything
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

function getConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

function getPlatformKeypair(): Keypair {
  const raw = process.env.SOLANA_ANCHOR_PRIVATE_KEY;
  if (!raw) throw new Error("SOLANA_ANCHOR_PRIVATE_KEY not set");
  const parsed = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

// ─── Canonical record hash ────────────────────────────────────────────────

export function hashAuthRecord(record: {
  orgId: string;
  agentWalletId: string;
  version: number;
  maxTxValueUsd: string | null;
  maxDailySpendUsd: string | null;
  whitelistedPrograms: string[];
  permittedTxTypes: string[];
  operationalPurpose: string;
  effectiveFrom: string;
}): string {
  const canonical = JSON.stringify(record, Object.keys(record).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function hashAuditSession(events: {
  sessionId: string;
  sequenceNum: number;
  eventType: string;
  reasoningSummary?: string;
  txSignature?: string;
  amountUsd?: string;
}[]): string {
  const eventHashes = events.map((e) =>
    crypto
      .createHash("sha256")
      .update(JSON.stringify(e, Object.keys(e).sort()))
      .digest("hex")
  );
  // Build Merkle root from sorted event hashes
  return buildMerkleRoot(eventHashes);
}

function buildMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return crypto.createHash("sha256").update("empty").digest("hex");
  if (hashes.length === 1) return hashes[0];

  const pairs: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = hashes[i + 1] ?? left; // duplicate last if odd
    pairs.push(
      crypto
        .createHash("sha256")
        .update(left + right)
        .digest("hex")
    );
  }
  return buildMerkleRoot(pairs);
}

// ─── Anchor an authorization record ──────────────────────────────────────

export async function anchorAuthRecord(params: {
  orgId: string;
  agentWalletId: string;
  authRecordId: string;
  version: number;
  recordHash: string;
}): Promise<{ txSignature: string; slot: number }> {
  const connection = getConnection();
  const payer = getPlatformKeypair();

  // Memo format: "AL:AUTH:v1:{orgId}:{agentWalletId}:{authId}:{hash}"
  const memo = `AL:AUTH:v1:${params.orgId}:${params.agentWalletId}:${params.authRecordId}:${params.recordHash}`;

  const tx = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  const { slot } = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  }) ?? { slot: 0 };

  console.log(`[anchor] AUTH record ${params.authRecordId} → tx ${sig} (slot ${slot})`);
  return { txSignature: sig, slot: slot ?? 0 };
}

// ─── Anchor an audit session Merkle root ─────────────────────────────────

export async function anchorAuditSession(params: {
  orgId: string;
  agentWalletId: string;
  sessionId: string;
  merkleRoot: string;
  logCount: number;
}): Promise<{ txSignature: string; slot: number }> {
  const connection = getConnection();
  const payer = getPlatformKeypair();

  // Memo format: "AL:SESSION:v1:{orgId}:{sessionId}:{merkleRoot}:{count}"
  const memo = `AL:SESSION:v1:${params.orgId}:${params.sessionId}:${params.merkleRoot}:${params.logCount}`;

  const tx = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  const result = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  console.log(`[anchor] SESSION ${params.sessionId} → tx ${sig}`);
  return { txSignature: sig, slot: result?.slot ?? 0 };
}

// ─── Verify an anchored record ────────────────────────────────────────────

export async function verifyAnchor(txSignature: string): Promise<{
  valid: boolean;
  memo?: string;
  slot?: number;
  blockTime?: number;
}> {
  try {
    const connection = getConnection();
    const tx = await connection.getParsedTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return { valid: false };

    // Extract memo from instructions
    const memoIx = tx.transaction.message.instructions.find(
      (ix) => "parsed" in ix && ix.programId.toString() === MEMO_PROGRAM_ID.toString()
    );

    const memo =
      memoIx && "parsed" in memoIx ? (memoIx.parsed as string) : undefined;

    return {
      valid: true,
      memo,
      slot: tx.slot,
      blockTime: tx.blockTime ?? undefined,
    };
  } catch (err) {
    console.error("[anchor] verify failed:", err);
    return { valid: false };
  }
}

// ─── Platform wallet balance check ───────────────────────────────────────

export async function getPlatformWalletBalance(): Promise<number> {
  const connection = getConnection();
  const keypair = getPlatformKeypair();
  const lamports = await connection.getBalance(keypair.publicKey);
  return lamports / LAMPORTS_PER_SOL;
}
