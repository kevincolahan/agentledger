import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: {
      org: {
        include: {
          members: {
            include: { user: { select: { email: true } } },
          },
        },
      },
    },
  });

  if (!member) return NextResponse.json({ error: "No org found" }, { status: 404 });

  return NextResponse.json({ org: member.org });
}
