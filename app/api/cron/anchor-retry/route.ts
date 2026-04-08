import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anchorAuthRecord, anchorAuditSession } from "@/lib/solana";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

async function handleRetry() {
  if (!process.env.SOLANA_ANCHOR_PRIVATE_KEY) {
    return NextResponse.json({ skipped: "SOLANA_ANCHOR_PRIVATE_KEY not configured" });
  }

  const results = { authAnchored: 0, sessionAnchored: 0, errors: 0 };

  // Retry unanchored authorization records (created > 2 min ago)
  const unanchoredAuths = await prisma.authorizationRecord.findMany({
    where: {
      onChainAnchorTx: null,
      revokedAt: null,
      createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) },
    },
    include: { agentWallet: { select: { orgId: true } } },
    take: 20,
  });

  for (const authRec of unanchoredAuths) {
    try {
      const { txSignature } = await anchorAuthRecord({
        orgId: authRec.agentWallet.orgId,
        agentWalletId: authRec.agentWalletId,
        authRecordId: authRec.id,
        version: authRec.version,
        recordHash: authRec.recordHash,
      });
      await prisma.authorizationRecord.update({
        where: { id: authRec.id },
        data: { onChainAnchorTx: txSignature, anchoredAt: new Date() },
      });
      results.authAnchored++;
      console.log(`[anchor-retry] AUTH ${authRec.id} → ${txSignature}`);
    } catch (err) {
      results.errors++;
      console.error(`[anchor-retry] AUTH ${authRec.id} failed:`, err);
    }
  }

  // Retry unanchored audit sessions (closed > 5 min ago with merkle root)
  const unanchoredSessions = await prisma.auditSession.findMany({
    where: {
      status: "CLOSED",
      onChainAnchorTx: null,
      sessionEnd: { lt: new Date(Date.now() - 5 * 60 * 1000) },
      merkleRoot: { not: null },
    },
    include: { agentWallet: { select: { orgId: true } } },
    take: 20,
  });

  for (const session of unanchoredSessions) {
    if (!session.merkleRoot) continue;
    try {
      const { txSignature } = await anchorAuditSession({
        orgId: session.agentWallet.orgId,
        agentWalletId: session.agentWalletId,
        sessionId: session.id,
        merkleRoot: session.merkleRoot,
        logCount: session.logCount,
      });
      await prisma.auditSession.update({
        where: { id: session.id },
        data: { onChainAnchorTx: txSignature, anchoredAt: new Date(), status: "ANCHORED" },
      });
      results.sessionAnchored++;
      console.log(`[anchor-retry] SESSION ${session.id} → ${txSignature}`);
    } catch (err) {
      results.errors++;
      console.error(`[anchor-retry] SESSION ${session.id} failed:`, err);
    }
  }

  console.log(`[anchor-retry] Done: +${results.authAnchored} auth, +${results.sessionAnchored} session, ${results.errors} errors`);
  return NextResponse.json(results);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handleRetry();
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handleRetry();
}
