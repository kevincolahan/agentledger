import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/utils";
import crypto from "crypto";
import { z } from "zod";

// GET /api/orgs/[orgId]/apikeys — list all keys (names + metadata, never the raw key)
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keys = await prisma.apiKey.findMany({
    where: { orgId: params.orgId, revokedAt: null },
    select: { id: true, name: true, lastUsed: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

const createKeySchema = z.object({ name: z.string().min(1).max(60) });

// POST /api/orgs/[orgId]/apikeys — create a new named API key
// Returns the raw key ONCE — store it securely, it cannot be retrieved again
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = createKeySchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  // Count existing active keys
  const count = await prisma.apiKey.count({
    where: { orgId: params.orgId, revokedAt: null },
  });
  if (count >= 10) {
    return NextResponse.json({ error: "Maximum 10 active API keys per organization" }, { status: 429 });
  }

  const rawKey  = generateApiKey();
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const created = await prisma.apiKey.create({
    data: { orgId: params.orgId, name: body.data.name, keyHash },
    select: { id: true, name: true, createdAt: true },
  });

  // Return the raw key only once
  return NextResponse.json(
    { key: { ...created, rawKey } },
    { status: 201 }
  );
}

// DELETE /api/orgs/[orgId]/apikeys — revoke a key by id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { keyId } = await req.json() as { keyId: string };
  if (!keyId) return NextResponse.json({ error: "keyId required" }, { status: 400 });

  await prisma.apiKey.updateMany({
    where: { id: keyId, orgId: params.orgId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ revoked: true });
}
