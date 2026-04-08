import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createAgentSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  walletChain: z.enum(["SOLANA", "BASE"]).default("SOLANA"),
  agentName: z.string().min(1).max(100),
  agentDescription: z.string().max(500).optional(),
  framework: z.enum(["ELIZAOS", "SOLANA_AGENT_KIT", "GOAT", "CUSTOM"]).default("CUSTOM"),
  registryAgentId: z.string().optional(),
});

// GET /api/orgs/[orgId]/agents
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify org membership
  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agents = await prisma.agentWallet.findMany({
    where: { orgId: params.orgId, status: { not: "ARCHIVED" } },
    include: {
      _count: {
        select: {
          authorizationRecords: true,
          auditSessions: true,
          policyFindings: { where: { status: "OPEN" } },
        },
      },
      authorizationRecords: {
        where: { effectiveTo: null },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ agents });
}

// POST /api/orgs/[orgId]/agents
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
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

  // Check wallet limit for plan
  const org = await prisma.organization.findUnique({ where: { id: params.orgId } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limits = { STARTER: 5, PROFESSIONAL: 25, ENTERPRISE: Infinity };
  const currentCount = await prisma.agentWallet.count({
    where: { orgId: params.orgId, status: { not: "ARCHIVED" } },
  });
  if (currentCount >= limits[org.planTier]) {
    return NextResponse.json(
      { error: `Agent wallet limit reached for ${org.planTier} plan. Upgrade to add more.` },
      { status: 402 }
    );
  }

  const body = createAgentSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  // Check for duplicate wallet address in org
  const existing = await prisma.agentWallet.findUnique({
    where: {
      orgId_walletAddress: {
        orgId: params.orgId,
        walletAddress: body.data.walletAddress,
      },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This wallet address is already registered in your organization." },
      { status: 409 }
    );
  }

  const { walletAddress, walletChain, agentName, agentDescription, framework, registryAgentId } = body.data;
  const agent = await prisma.agentWallet.create({
    data: {
      org: { connect: { id: params.orgId } },
      walletAddress,
      walletChain,
      agentName,
      agentDescription,
      framework,
      registryAgentId,
    },
  });

  return NextResponse.json({ agent }, { status: 201 });
}
