import { NextRequest, NextResponse } from "next/server";
import { auth }                     from "@/lib/auth";
import { prisma }                   from "@/lib/prisma";
import { runMonitoringRound }       from "@/lib/marketing/monitor";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim());

async function requireAdmin(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return null;
  if (!ADMIN_EMAILS.includes(session.user.email)) return null;
  return session.user;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Return high-value mentions with suggested replies
  const mentions = await prisma.marketingMetric.findMany({
    where: {
      metric: { startsWith: "mention_" },
      value:  { gte: 6 }, // Score 6+ only
    },
    orderBy: { date: "desc" },
    take: 30,
  });

  const formatted = mentions.map(m => ({
    id:             m.id,
    score:          m.value,
    date:           m.date,
    ...(m.metadata as any),
  }));

  return NextResponse.json({ mentions: formatted });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action } = await req.json() as { action: string };

  if (action === "run_now") {
    const result = await runMonitoringRound();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
