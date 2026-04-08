import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  orgName: z.string().min(2).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Don't create a second org if one already exists
  const existing = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "Organization already exists" }, { status: 409 });
  }

  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const slug =
    body.data.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    session.user.id.slice(-6);

  const org = await prisma.organization.create({
    data: {
      name: body.data.orgName,
      slug,
      members: { create: { userId: session.user.id, role: "OWNER" } },
    },
  });

  return NextResponse.json({ org }, { status: 201 });
}
