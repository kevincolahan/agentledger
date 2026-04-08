import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    userId: session.user.id,
    email: session.user.email,
    orgId: member?.org.id ?? null,
    orgSlug: member?.org.slug ?? null,
    orgName: member?.org.name ?? null,
    planTier: member?.org.planTier ?? null,
    role: member?.role ?? null,
  });
}
