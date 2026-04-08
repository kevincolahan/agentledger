import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const disposeSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "REMEDIATED", "ACCEPTED_RISK"]),
  dispositionNotes: z.string().min(5, "Please provide disposition notes"),
});

// PUT /api/orgs/[orgId]/findings/[findingId]
export async function PUT(
  req: NextRequest,
  { params }: { params: { orgId: string; findingId: string } }
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

  // Verify finding belongs to this org
  const finding = await prisma.policyFinding.findFirst({
    where: { id: params.findingId, agentWallet: { orgId: params.orgId } },
  });
  if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const body = disposeSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.policyFinding.update({
    where: { id: params.findingId },
    data: {
      status: body.data.status,
      dispositionNotes: body.data.dispositionNotes,
      disposedBy: session.user.id,
      disposedAt: new Date(),
    },
  });

  return NextResponse.json({ finding: updated });
}
