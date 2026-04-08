import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSolanaPubkey } from "@/lib/utils";

// GET /api/orgs/[orgId]/agents/[agentId]/validate?address=...
// Also used standalone: GET /api/validate-wallet?address=...&orgId=...
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const address = req.nextUrl.searchParams.get("address");
  const orgId   = req.nextUrl.searchParams.get("orgId");

  if (!address) return NextResponse.json({ error: "address param required" }, { status: 400 });

  const valid = isValidSolanaPubkey(address);
  if (!valid) {
    return NextResponse.json({
      valid: false,
      reason: "Invalid Solana public key format. Expected 32–44 base58 characters.",
    });
  }

  if (orgId) {
    const existing = await prisma.agentWallet.findFirst({
      where: { orgId, walletAddress: address, status: { not: "ARCHIVED" } },
      select: { agentName: true },
    });
    if (existing) {
      return NextResponse.json({
        valid: false,
        reason: `This wallet is already registered as "${existing.agentName}"`,
      });
    }
  }

  return NextResponse.json({ valid: true });
}
