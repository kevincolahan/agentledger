import { NextRequest, NextResponse } from "next/server";
import { auth }                     from "@/lib/auth";
import { prisma }                   from "@/lib/prisma";
import { sourceFederalContractors, sourceSolanaBuilders } from "@/lib/marketing/outreach";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim());

async function requireAdmin(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return null;
  if (!ADMIN_EMAILS.includes(session.user.email)) return null;
  return session.user;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "pipeline";

  if (view === "pipeline") {
    const [total, contacted, replied, customers] = await Promise.all([
      prisma.outreachContact.count(),
      prisma.outreachContact.count({ where: { status: "CONTACTED" } }),
      prisma.outreachContact.count({ where: { status: "REPLIED" } }),
      prisma.outreachContact.count({ where: { status: "CUSTOMER" } }),
    ]);
    const recent = await prisma.outreachContact.findMany({
      orderBy: { lastContactedAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ total, contacted, replied, customers, recent });
  }

  if (view === "events") {
    const events = await prisma.outreachEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { contact: { select: { email: true, company: true } } },
    });
    return NextResponse.json({ events });
  }

  if (view === "metrics") {
    const metrics = await prisma.marketingMetric.findMany({
      orderBy: { date: "desc" },
      take: 100,
    });
    return NextResponse.json({ metrics });
  }

  return NextResponse.json({ error: "Unknown view" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, ...params } = await req.json() as { action: string; [k: string]: any };

  if (action === "source_federal") {
    const contacts = await sourceFederalContractors(params.limit ?? 50);
    let imported = 0;
    for (const c of contacts) {
      if (!c.email) continue;
      await prisma.outreachContact.upsert({
        where:  { email: c.email },
        update: {},
        create: {
          email:     c.email,
          firstName: c.firstName,
          lastName:  c.lastName,
          company:   c.company,
          cageCode:  c.cageCode,
          uei:       c.uei,
          naicsCode: c.naicsCode,
          source:    "SAM_GOV",
        },
      });
      imported++;
    }
    return NextResponse.json({ imported });
  }

  if (action === "source_solana") {
    const builders = await sourceSolanaBuilders();
    let imported = 0;
    for (const b of builders) {
      const email = `registry+${b.walletAddress.slice(0,8)}@placeholder.agentledger.io`;
      await prisma.outreachContact.upsert({
        where:  { email },
        update: {},
        create: {
          email,
          company:       b.agentName ?? "Solana builder",
          solanaWallet:  b.walletAddress,
          registryAgentId: b.registryId,
          source:        "SOLANA_REGISTRY",
        } as any,
      });
      imported++;
    }
    return NextResponse.json({ imported });
  }

  if (action === "enroll_sequence") {
    const { contactIds, sequenceId } = params;
    const enrolled = await prisma.contactSequence.createMany({
      data: contactIds.map((id: string) => ({
        contactId:   id,
        sequenceId,
        currentStep: 0,
        nextSendAt:  new Date(Date.now() + 60 * 60 * 1000), // First email in 1 hour
      })),
      skipDuplicates: true,
    });
    return NextResponse.json({ enrolled: enrolled.count });
  }

  if (action === "create_sequence") {
    const seq = await prisma.outreachSequence.create({
      data: {
        name:           params.name,
        description:    params.description,
        targetAudience: params.targetAudience,
        steps: params.steps ?? [
          { delayDays: 0,  step: 0 },
          { delayDays: 4,  step: 1 },
          { delayDays: 7,  step: 2 },
        ],
      },
    });
    return NextResponse.json({ sequence: seq });
  }

  if (action === "mark_status") {
    await prisma.outreachContact.update({
      where: { id: params.contactId },
      data:  { status: params.status },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
