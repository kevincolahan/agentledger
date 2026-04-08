import { NextRequest, NextResponse } from "next/server";
import { runDueSequenceSteps }      from "@/lib/marketing/outreach";
import { runOnboardingDrip }        from "@/lib/marketing/drip";
import { runWeeklyContentGeneration, sendMonthlyNewsletter } from "@/lib/marketing/content";
import { runMonitoringRound }       from "@/lib/marketing/monitor";
import { prisma }                   from "@/lib/prisma";

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

async function handleTask(task: string) {
  switch (task) {
    case "outreach": {
      const [seqResult, dripResult] = await Promise.all([
        runDueSequenceSteps(),
        runOnboardingDrip(),
      ]);
      const result = { ...seqResult, dripSent: dripResult.sent };
      await prisma.marketingMetric.create({
        data: { metric: "outreach_run", value: result.sent, metadata: result },
      });
      return NextResponse.json(result);
    }

    case "monitor": {
      const result = await runMonitoringRound();
      await prisma.marketingMetric.create({
        data: { metric: "monitor_run", value: result.highValueMentions, metadata: result },
      });
      return NextResponse.json(result);
    }

    case "content": {
      const result = await runWeeklyContentGeneration();
      await prisma.marketingMetric.create({
        data: { metric: "content_generated", value: 1, metadata: result },
      });
      return NextResponse.json(result);
    }

    case "newsletter": {
      const result = await sendMonthlyNewsletter();
      await prisma.marketingMetric.create({
        data: { metric: "newsletter_run", value: result.sent, metadata: result },
      });
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json({ error: `Unknown task: ${task}` }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = req.nextUrl.searchParams.get("task");
  if (!task) return NextResponse.json({ error: "Missing ?task= parameter" }, { status: 400 });
  return handleTask(task);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as { task: string };
  if (!body.task) return NextResponse.json({ error: "Missing task in body" }, { status: 400 });
  return handleTask(body.task);
}
