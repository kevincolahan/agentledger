import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportDownloadUrl } from "@/lib/r2";

// GET /api/orgs/[orgId]/reports/[reportId]
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string; reportId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({
    where: { orgId: params.orgId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const report = await prisma.auditReport.findFirst({
    where: { id: params.reportId, orgId: params.orgId },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Refresh download URL if complete (R2 presigned URLs expire after 1 hour)
  let downloadUrl = report.r2Url;
  if (report.status === "COMPLETE" && report.r2Key) {
    downloadUrl = await getReportDownloadUrl(report.r2Key);
    // Update cached URL
    await prisma.auditReport.update({
      where: { id: report.id },
      data: { r2Url: downloadUrl },
    });
  }

  return NextResponse.json({ report: { ...report, r2Url: downloadUrl } });
}
