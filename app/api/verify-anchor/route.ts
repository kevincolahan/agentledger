import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyAnchor } from "@/lib/solana";
import { prisma } from "@/lib/prisma";

// GET /api/verify-anchor?tx=<solana_tx_sig>&type=AUTH|SESSION
// Public verification endpoint — can be called without auth for auditor use
export async function GET(req: NextRequest) {
  const tx   = req.nextUrl.searchParams.get("tx");
  const type = req.nextUrl.searchParams.get("type") as "AUTH" | "SESSION" | null;

  if (!tx) return NextResponse.json({ error: "tx param required" }, { status: 400 });

  // Verify on-chain
  const onChain = await verifyAnchor(tx);
  if (!onChain.valid) {
    return NextResponse.json({
      valid: false,
      reason: "Transaction not found or invalid on Solana",
    });
  }

  const memo = onChain.memo ?? "";
  const isAgentLedger = memo.startsWith("AL:");

  if (!isAgentLedger) {
    return NextResponse.json({
      valid: false,
      reason: "Transaction exists but is not an AgentLedger anchor",
      memo,
    });
  }

  // Parse memo fields
  const parts   = memo.split(":");
  const memoType = parts[1]; // AUTH or SESSION
  const hash    = parts[parts.length - 1];

  // Cross-reference with our database
  let dbRecord: { id: string; type: string; hash: string; createdAt: Date } | null = null;

  if (memoType === "AUTH") {
    const authId = parts[4];
    const record = await prisma.authorizationRecord.findUnique({
      where: { id: authId },
      select: { id: true, recordHash: true, createdAt: true, onChainAnchorTx: true },
    });
    if (record) {
      dbRecord = {
        id: record.id,
        type: "AUTH",
        hash: record.recordHash,
        createdAt: record.createdAt,
      };
    }
  } else if (memoType === "SESSION") {
    const sessionId = parts[4];
    const record = await prisma.auditSession.findUnique({
      where: { id: sessionId },
      select: { id: true, merkleRoot: true, sessionStart: true, onChainAnchorTx: true },
    });
    if (record && record.merkleRoot) {
      dbRecord = {
        id: record.id,
        type: "SESSION",
        hash: record.merkleRoot,
        createdAt: record.sessionStart,
      };
    }
  }

  const hashMatch = dbRecord ? dbRecord.hash === hash : null;

  return NextResponse.json({
    valid: true,
    txSignature: tx,
    slot: onChain.slot,
    blockTime: onChain.blockTime,
    memo,
    memoType,
    contentHash: hash,
    database: dbRecord
      ? {
          found: true,
          id: dbRecord.id,
          type: dbRecord.type,
          createdAt: dbRecord.createdAt,
          hashMatch,
          tampered: hashMatch === false,
        }
      : { found: false, reason: "Record not found in database — may be from a different org or deleted" },
  });
}
