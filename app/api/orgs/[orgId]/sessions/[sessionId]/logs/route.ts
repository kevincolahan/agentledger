import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/orgs/[orgId]/sessions/[sessionId]/logs
// Returns paginated audit log entries for a session
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string; sessionId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify session belongs to this org
  const auditSession = await prisma.auditSession.findFirst({
    where: { id: params.sessionId, agentWallet: { orgId: params.orgId } },
    select: {
      id: true,
      agentWalletId: true,
      sessionStart: true,
      sessionEnd: true,
      logCount: true,
      merkleRoot: true,
      onChainAnchorTx: true,
      status: true,
      agentWallet: { select: { agentName: true, walletAddress: true } },
    },
  });
  if (!auditSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const after  = parseInt(searchParams.get("after") ?? "0"); // sequenceNum cursor

  const logs = await prisma.auditLogEntry.findMany({
    where: {
      sessionId: params.sessionId,
      sequenceNum: { gt: after },
    },
    orderBy: { sequenceNum: "asc" },
    take: limit,
    select: {
      id: true,
      sequenceNum: true,
      eventType: true,
      reasoningSummary: true,
      promptContextHash: true,
      toolName: true,
      toolParamsHash: true,
      txSignature: true,
      onChainProgram: true,
      amountUsd: true,
      flaggedDeviation: true,
      deviationNotes: true,
      createdAt: true,
    },
  });

  const nextAfter = logs.length === limit ? logs[logs.length - 1]?.sequenceNum : null;

  return NextResponse.json({
    session: auditSession,
    logs,
    nextAfter,
    hasMore: nextAfter !== null,
  });
}
