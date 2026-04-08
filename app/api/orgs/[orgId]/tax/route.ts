import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncWalletTaxEvents, getTaxPosition } from "@/lib/tax";

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.orgMember.findFirst({ where: { orgId: params.orgId, userId: session.user.id } });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
  if (isNaN(year) || year < 2020 || year > 2030) return NextResponse.json({ error: "Invalid tax year" }, { status: 400 });
  const position = await getTaxPosition(params.orgId, year);
  return NextResponse.json({ position });
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.orgMember.findFirst({ where: { orgId: params.orgId, userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } } });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
  if (isNaN(year)) return NextResponse.json({ error: "Pass ?year=2025" }, { status: 400 });
  const wallets = await prisma.agentWallet.findMany({ where: { orgId: params.orgId, status: { not: "ARCHIVED" } } });
  Promise.all(wallets.map((w) => syncWalletTaxEvents(w.id, year).catch(console.error)));
  return NextResponse.json({ message: `Tax sync started for ${wallets.length} wallets.`, wallets: wallets.length, year }, { status: 202 });
}
