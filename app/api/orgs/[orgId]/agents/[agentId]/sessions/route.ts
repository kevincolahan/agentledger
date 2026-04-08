import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/orgs/[orgId]/agents/[agentId]/sessions
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string; agentId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agent = await prisma.agentWallet.findFirst({
    where: { id: params.agentId, orgId: params.orgId },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const cursor = searchParams.get("cursor");

  const sessions = await prisma.auditSession.findMany({
    where: { agentWalletId: params.agentId },
    orderBy: { sessionStart: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      sessionStart: true,
      sessionEnd: true,
      logCount: true,
      merkleRoot: true,
      onChainAnchorTx: true,
      anchoredAt: true,
      status: true,
    },
  });

  const hasMore = sessions.length > limit;
  const items   = hasMore ? sessions.slice(0, limit) : sessions;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({ sessions: items, nextCursor, hasMore });
}
