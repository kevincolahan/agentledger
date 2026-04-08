import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashAuthRecord, anchorAuthRecord } from "@/lib/solana";
import { z } from "zod";
import crypto from "crypto";

const createAuthSchema = z.object({
  maxTxValueUsd: z.number().positive().optional(),
  maxDailySpendUsd: z.number().positive().optional(),
  whitelistedPrograms: z.array(z.string()).default([]),
  permittedTxTypes: z.array(z.string()).min(1, "At least one transaction type required"),
  operationalPurpose: z.string().min(10, "Operational purpose must be at least 10 characters"),
  effectiveFrom: z.string().datetime().optional(),
  orgSignerPubkey: z.string().default("platform"),
});

export async function GET(req: NextRequest, { params }: { params: { orgId: string; agentId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.orgMember.findFirst({ where: { orgId: params.orgId, userId: session.user.id } });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const agent = await prisma.agentWallet.findFirst({ where: { id: params.agentId, orgId: params.orgId } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const records = await prisma.authorizationRecord.findMany({ where: { agentWalletId: params.agentId }, orderBy: { version: "desc" } });
  return NextResponse.json({ records, agent });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string; agentId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.orgMember.findFirst({ where: { orgId: params.orgId, userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } } });
  if (!member) return NextResponse.json({ error: "Forbidden — only Owners and Admins can create authorization records" }, { status: 403 });
  const agent = await prisma.agentWallet.findFirst({ where: { id: params.agentId, orgId: params.orgId } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (agent.status === "ARCHIVED") return NextResponse.json({ error: "Cannot authorize an archived agent" }, { status: 400 });

  const body = createAuthSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  const data = body.data;

  const lastRecord = await prisma.authorizationRecord.findFirst({ where: { agentWalletId: params.agentId }, orderBy: { version: "desc" } });
  const version = (lastRecord?.version ?? 0) + 1;
  const effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date();

  const canonicalRecord = {
    orgId: params.orgId, agentWalletId: params.agentId, version,
    maxTxValueUsd: data.maxTxValueUsd?.toString() ?? null,
    maxDailySpendUsd: data.maxDailySpendUsd?.toString() ?? null,
    whitelistedPrograms: [...data.whitelistedPrograms].sort(),
    permittedTxTypes: [...data.permittedTxTypes].sort(),
    operationalPurpose: data.operationalPurpose,
    effectiveFrom: effectiveFrom.toISOString(),
  };
  const recordHash = hashAuthRecord(canonicalRecord);
  const signature = crypto.createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret").update(recordHash).digest("hex");

  await prisma.authorizationRecord.updateMany({ where: { agentWalletId: params.agentId, effectiveTo: null, revokedAt: null }, data: { effectiveTo: effectiveFrom } });

  const authRecord = await prisma.authorizationRecord.create({
    data: {
      agentWalletId: params.agentId, version,
      maxTxValueUsd: data.maxTxValueUsd, maxDailySpendUsd: data.maxDailySpendUsd,
      whitelistedPrograms: data.whitelistedPrograms, permittedTxTypes: data.permittedTxTypes,
      operationalPurpose: data.operationalPurpose, orgSignerPubkey: data.orgSignerPubkey,
      signature, recordHash, effectiveFrom,
    },
  });

  if (process.env.SOLANA_ANCHOR_PRIVATE_KEY) {
    anchorAuthRecord({ orgId: params.orgId, agentWalletId: params.agentId, authRecordId: authRecord.id, version, recordHash })
      .then(async ({ txSignature }) => {
        await prisma.authorizationRecord.update({ where: { id: authRecord.id }, data: { onChainAnchorTx: txSignature, anchoredAt: new Date() } });
      })
      .catch((err) => console.error(`[auth] Anchoring failed for ${authRecord.id}:`, err));
  }

  return NextResponse.json({ record: authRecord, message: "Authorization record created. On-chain anchoring in progress." }, { status: 201 });
}
