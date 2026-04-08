import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/orgs/[orgId]/agents/[agentId]
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
    include: {
      authorizationRecords: {
        orderBy: { version: "desc" },
      },
      auditSessions: {
        orderBy: { sessionStart: "desc" },
        take: 10,
        select: {
          id: true,
          sessionStart: true,
          sessionEnd: true,
          logCount: true,
          merkleRoot: true,
          onChainAnchorTx: true,
          status: true,
        },
      },
      policyFindings: {
        where: { status: "OPEN" },
        orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
        take: 20,
      },
      _count: {
        select: {
          authorizationRecords: true,
          auditSessions: true,
          policyFindings: true,
          taxEvents: true,
        },
      },
    },
  });

  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  return NextResponse.json({ agent });
}

const patchSchema = z.object({
  agentName: z.string().min(1).max(100).optional(),
  agentDescription: z.string().max(500).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
});

// PATCH /api/orgs/[orgId]/agents/[agentId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string; agentId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: {
      orgId: params.orgId,
      userId: session.user.id,
      role: { in: ["OWNER", "ADMIN"] },
    },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const agent = await prisma.agentWallet.updateMany({
    where: { id: params.agentId, orgId: params.orgId },
    data: body.data,
  });

  if (agent.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
