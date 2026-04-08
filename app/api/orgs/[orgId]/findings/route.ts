import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runPolicyScan } from "@/lib/policy-engine";
import { z } from "zod";

// GET /api/orgs/[orgId]/findings
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");
  const agentId = searchParams.get("agentId");

  const findings = await prisma.policyFinding.findMany({
    where: {
      agentWallet: { orgId: params.orgId },
      ...(status ? { status: status as any } : {}),
      ...(severity ? { severity: severity as any } : {}),
      ...(agentId ? { agentWalletId: agentId } : {}),
    },
    include: {
      agentWallet: { select: { agentName: true, walletAddress: true } },
      authorization: { select: { version: true, operationalPurpose: true } },
    },
    orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ findings });
}

// POST /api/orgs/[orgId]/findings/run — trigger on-demand policy scan
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

  // Run async — don't block the response
  runPolicyScan(params.orgId)
    .then(({ agentsScanned, findingsCreated }) => {
      console.log(`[policy] On-demand scan for ${params.orgId}: ${agentsScanned} agents, ${findingsCreated} findings`);
    })
    .catch(console.error);

  return NextResponse.json(
    { message: "Policy scan started. Check findings in a few moments." },
    { status: 202 }
  );
}
