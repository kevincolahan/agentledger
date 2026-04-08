import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPolicyScan } from "@/lib/policy-engine";

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sends this header automatically
  if (req.headers.get("x-vercel-cron") === "1") return true;
  // Manual calls use Bearer token
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

async function handleScan() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  const results: { orgId: string; agentsScanned: number; findingsCreated: number }[] = [];

  for (const org of orgs) {
    try {
      const result = await runPolicyScan(org.id);
      results.push({ orgId: org.id, ...result });
    } catch (err) {
      console.error(`[cron] Policy scan failed for org ${org.id}:`, err);
      results.push({ orgId: org.id, agentsScanned: 0, findingsCreated: 0 });
    }
  }

  const totalFindings = results.reduce((s, r) => s + r.findingsCreated, 0);
  console.log(`[cron] Nightly scan complete: ${orgs.length} orgs, ${totalFindings} new findings`);

  return NextResponse.json({ results, totalFindings });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handleScan();
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handleScan();
}
