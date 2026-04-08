import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReportReady } from "@/lib/email";
import { generateAuditPackagePdf } from "@/lib/pdf";
import { uploadReportPdf, getReportDownloadUrl } from "@/lib/r2";
import { z } from "zod";

const generateReportSchema = z.object({
  reportType: z.enum(["FULL_AUDIT_PACKAGE", "COMPLIANCE_ONLY", "TAX_POSITION", "FINDINGS_SUMMARY"])
    .default("FULL_AUDIT_PACKAGE"),
  reportFormat: z.enum(["STANDARD", "FEDERAL", "CPA"]).default("STANDARD"),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  agentIds: z.array(z.string()).optional(), // null = all agents
});

// POST /api/orgs/[orgId]/reports
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = generateReportSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { reportType, reportFormat, periodStart, periodEnd, agentIds } = body.data;

  const org = await prisma.organization.findUnique({ where: { id: params.orgId } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  // Create pending report record
  const report = await prisma.auditReport.create({
    data: {
      orgId: params.orgId,
      reportType,
      reportFormat,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      status: "GENERATING",
      requestedBy: session.user.id,
    },
  });

  // Kick off generation in background — respond immediately with pending status
  generateReport({ report, org, agentIds, requestedByEmail: session.user.email ?? undefined }).catch(
    async (err) => {
      console.error(`[report] Generation failed for ${report.id}:`, err);
      await prisma.auditReport.update({
        where: { id: report.id },
        data: { status: "FAILED", errorMessage: String(err) },
      });
    }
  );

  return NextResponse.json(
    { report, message: "Report generation started. Poll /api/orgs/[orgId]/reports/[reportId] for status." },
    { status: 202 }
  );
}

// GET /api/orgs/[orgId]/reports
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

  const reports = await prisma.auditReport.findMany({
    where: { orgId: params.orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ reports });
}

// ─── Background generation ────────────────────────────────────────────────

async function generateReport({
  report,
  org,
  agentIds,
  requestedByEmail,
}: {
  report: Awaited<ReturnType<typeof prisma.auditReport.create>>;
  org: Awaited<ReturnType<typeof prisma.organization.findUniqueOrThrow>>;
  agentIds?: string[];
  requestedByEmail?: string;
}) {
  // Fetch all agent data for the period
  const agentQuery = {
    where: {
      orgId: org.id,
      status: { not: "ARCHIVED" as const },
      ...(agentIds ? { id: { in: agentIds } } : {}),
    },
    include: {
      authorizationRecords: {
        where: {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date(report.periodStart) } },
          ],
        },
        orderBy: { version: "desc" as const },
      },
      policyFindings: {
        where: {
          detectedAt: {
            gte: new Date(report.periodStart),
            lte: new Date(report.periodEnd),
          },
        },
        orderBy: [{ severity: "asc" as const }, { detectedAt: "desc" as const }],
      },
      _count: {
        select: {
          auditSessions: true,
          taxEvents: true,
        },
      },
    },
  };

  const agents = await prisma.agentWallet.findMany(agentQuery);

  // Generate PDF
  const pdfBuffer = await generateAuditPackagePdf({
    org,
    report,
    agents,
    generatedAt: new Date(),
    generatedBy: requestedByEmail,
  });

  // Upload to R2
  const { key, size } = await uploadReportPdf(org.id, report.id, pdfBuffer);
  const downloadUrl = await getReportDownloadUrl(key);

  // Update report record
  const openFindings = agents.flatMap((a) => a.policyFindings.filter((f) => f.status === "OPEN"));

  await prisma.auditReport.update({
    where: { id: report.id },
    data: {
      status: "COMPLETE",
      r2Key: key,
      r2Url: downloadUrl,
      fileSizeBytes: size,
      generatedAt: new Date(),
      agentCount: agents.length,
      findingCount: openFindings.length,
    },
  });

  console.log(`[report] Generated ${report.id} (${(size / 1024).toFixed(1)}KB) → ${key}`);

  // Notify requester
  if (requestedByEmail) {
    sendReportReady({
      to: requestedByEmail,
      orgName: org.name,
      reportId: report.id,
      reportType: report.reportType,
      periodStart: new Date(report.periodStart),
      periodEnd: new Date(report.periodEnd),
      downloadUrl: downloadUrl,
      findingCount: openFindings.length,
      agentCount: agents.length,
    }).catch((err) => console.error("[report] Email notification failed:", err));
  }
}
