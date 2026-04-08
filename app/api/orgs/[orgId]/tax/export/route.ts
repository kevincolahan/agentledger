import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/orgs/[orgId]/tax/export?year=2025
// Returns a CSV of all tax events for the year — formatted for CPA import
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

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
  if (isNaN(year)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });

  const events = await prisma.taxEvent.findMany({
    where: {
      agentWallet: { orgId: params.orgId },
      taxYear: year,
    },
    include: {
      agentWallet: { select: { agentName: true, walletAddress: true } },
    },
    orderBy: [{ agentWallet: { agentName: "asc" } }, { blockTime: "asc" }],
  });

  // Build CSV with CPA-friendly headers
  const headers = [
    "Date",
    "Agent Name",
    "Wallet Address",
    "Transaction Type",
    "Tax Event Type",
    "Token Symbol",
    "Token Amount",
    "USD Value at Time",
    "Cost Basis USD",
    "Realized Gain/Loss USD",
    "Transaction Signature",
    "Notes",
  ];

  const TAX_TYPE_LABEL: Record<string, string> = {
    STAKING_INCOME: "Staking Income (Ordinary)",
    API_FEE_INCOME: "API Fee Income (Ordinary)",
    SWAP_REALIZED_GAIN: "Swap — Realized Gain (Capital)",
    SWAP_REALIZED_LOSS: "Swap — Realized Loss (Capital)",
    TRANSFER_IN: "Transfer In (Non-taxable)",
    TRANSFER_OUT: "Transfer Out (Non-taxable)",
    TX_FEE: "Transaction Fee (Deductible Expense)",
    AIRDROP_INCOME: "Airdrop Income (Ordinary)",
  };

  const rows = events.map((e) => [
    e.blockTime ? new Date(e.blockTime).toISOString().split("T")[0] : "",
    e.agentWallet.agentName,
    e.agentWallet.walletAddress,
    e.eventType,
    TAX_TYPE_LABEL[e.eventType] ?? e.eventType,
    e.tokenSymbol ?? "",
    e.tokenAmount != null ? Number(e.tokenAmount).toFixed(8) : "",
    e.usdValueAtTime != null ? Number(e.usdValueAtTime).toFixed(2) : "",
    e.costBasisUsd != null ? Number(e.costBasisUsd).toFixed(2) : "",
    e.realizedGlUsd != null ? Number(e.realizedGlUsd).toFixed(2) : "",
    e.txSignature ?? "",
    e.notes ?? "",
  ]);

  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;

  const csv = [
    `# AgentLedger Tax Export — Tax Year ${year}`,
    `# Organization: ${params.orgId}`,
    `# Generated: ${new Date().toISOString()}`,
    `# DISCLAIMER: For CPA review only. AgentLedger is not a licensed tax advisor.`,
    `# Per IRS Rev. Proc. 2024-28, cost basis is tracked per-wallet (effective Jan 1 2026).`,
    "",
    headers.map(escape).join(","),
    ...rows.map((r) => r.map((v) => escape(String(v))).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="agentledger-tax-${year}-${params.orgId.slice(-8)}.csv"`,
    },
  });
}
