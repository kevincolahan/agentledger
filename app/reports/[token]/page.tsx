import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatUsd, truncatePubkey, solscanTxUrl } from "@/lib/utils";
import Link from "next/link";

// Shareable report page — no auth required, token-gated
// Token is the report ID (public access for auditors)
export default async function ShareableReportPage({
  params,
}: {
  params: { token: string };
}) {
  const report = await prisma.auditReport.findUnique({
    where: { id: params.token },
    include: {
      org: { select: { name: true } },
    },
  });

  if (!report || report.status !== "COMPLETE") notFound();

  // Fetch the full data to render inline HTML
  const agents = await prisma.agentWallet.findMany({
    where: { orgId: report.orgId, status: { not: "ARCHIVED" } },
    include: {
      authorizationRecords: {
        where: {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: report.periodStart } },
          ],
        },
        orderBy: { version: "desc" },
        take: 3,
      },
      policyFindings: {
        where: {
          detectedAt: { gte: report.periodStart, lte: report.periodEnd },
        },
        orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
        take: 20,
      },
    },
    take: 50,
  });

  const isFederal = report.reportFormat === "FEDERAL";
  const openFindings = agents.flatMap((a) => a.policyFindings.filter((f) => f.status === "OPEN"));
  const criticalCount = openFindings.filter((f) => f.severity === "CRITICAL").length;
  const periodStr = (d: Date) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Verification bar */}
      <div className="bg-green-500/10 border-b border-green-500/20 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span>⚓</span>
          <span>AgentLedger Audit Report · {report.org.name}</span>
          <span className="text-green-400/50">·</span>
          <span>ID: {report.id.slice(-12)}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/verify`} className="text-[11px] text-green-400/70 hover:text-green-400">
            Verify anchors →
          </Link>
          {report.r2Url && (
            <a href={report.r2Url} className="text-[11px] bg-green-500 text-black font-semibold px-3 py-1 rounded-md hover:bg-green-400">
              Download PDF
            </a>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="text-xs text-white/30 uppercase tracking-widest mb-3">
            {isFederal ? "CMMC / NIST SP 800-53 Compliance Report" : "AgentLedger Audit Report"}
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">
            Autonomous Agent Compliance Report
          </h1>
          <p className="text-white/40">
            {report.org.name} · {periodStr(report.periodStart)} – {periodStr(report.periodEnd)}
          </p>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          {[
            { label: "Agent wallets", value: String(agents.length) },
            { label: "Auth records", value: String(agents.reduce((s, a) => s + a.authorizationRecords.length, 0)) },
            { label: "Open findings", value: String(openFindings.length), warn: openFindings.length > 0 },
            { label: "Critical", value: String(criticalCount), warn: criticalCount > 0 },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-5 ${s.warn ? "bg-amber-500/5 border-amber-500/20" : "bg-white/[0.02] border-white/[0.06]"}`}>
              <div className={`text-2xl font-semibold mb-1 ${s.warn ? "text-amber-400" : "text-white"}`}>{s.value}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className={`rounded-xl border p-5 mb-10 ${openFindings.length === 0 ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
          <div className={`font-semibold text-sm mb-2 ${openFindings.length === 0 ? "text-green-400" : "text-amber-400"}`}>
            {openFindings.length === 0
              ? "✓ No open policy findings"
              : `⚠ ${openFindings.length} open finding${openFindings.length > 1 ? "s" : ""} require attention`}
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            {isFederal
              ? `${agents.length} autonomous agent wallet${agents.length > 1 ? "s" : ""} operated under documented authorization per NIST SP 800-53 AC-2 during this period.`
              : `${agents.length} agent wallet${agents.length > 1 ? "s" : ""} operated under signed, on-chain-anchored authorization records during this period.`}
            {openFindings.length === 0
              ? " All agent activity was within documented authorization scope."
              : ` ${criticalCount > 0 ? `${criticalCount} critical finding${criticalCount > 1 ? "s" : ""} require immediate action.` : ""}`}
          </p>
        </div>

        {/* Agent authorization records */}
        <h2 className="text-base font-semibold text-white mb-5">
          {isFederal ? "Agent Access Authorization Records (AC-2)" : "Agent Authorization Records"}
        </h2>

        <div className="space-y-5 mb-12">
          {agents.map((agent) => {
            const activeAuth = agent.authorizationRecords.find((r) => !r.effectiveTo);
            return (
              <div key={agent.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-medium text-white">{agent.agentName}</div>
                    <div className="text-[11px] font-mono text-white/30 mt-0.5">
                      {agent.walletAddress}
                    </div>
                  </div>
                  {activeAuth ? (
                    <span className="text-[11px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                      v{activeAuth.version} authorized
                    </span>
                  ) : (
                    <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      no authorization
                    </span>
                  )}
                </div>

                {activeAuth && (
                  <div className="space-y-2 text-xs">
                    <div className="flex gap-4">
                      <span className="text-white/30 w-32">Purpose</span>
                      <span className="text-white/70 flex-1">{activeAuth.operationalPurpose}</span>
                    </div>
                    {activeAuth.maxTxValueUsd && (
                      <div className="flex gap-4">
                        <span className="text-white/30 w-32">Max per tx</span>
                        <span className="text-white/70">{formatUsd(Number(activeAuth.maxTxValueUsd))}</span>
                      </div>
                    )}
                    {activeAuth.permittedTxTypes.length > 0 && (
                      <div className="flex gap-4">
                        <span className="text-white/30 w-32">Permitted</span>
                        <span className="text-white/70">{activeAuth.permittedTxTypes.join(", ")}</span>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <span className="text-white/30 w-32">Record hash</span>
                      <span className="text-white/40 font-mono text-[10px]">{activeAuth.recordHash}</span>
                    </div>
                    {activeAuth.onChainAnchorTx && (
                      <div className="flex gap-4 items-center">
                        <span className="text-white/30 w-32">On-chain anchor</span>
                        <a
                          href={solscanTxUrl(activeAuth.onChainAnchorTx)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-green-400/70 hover:text-green-400"
                        >
                          {truncatePubkey(activeAuth.onChainAnchorTx, 16, 8)} ↗
                        </a>
                        <span className="text-[10px] text-green-400">⚓ verified</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Findings */}
        {openFindings.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-white mb-5">
              {isFederal ? "Policy Deviation Findings (POA&M)" : "Policy Findings"}
            </h2>
            <div className="space-y-3 mb-12">
              {openFindings.map((f) => (
                <div key={f.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      f.severity === "CRITICAL" ? "bg-red-500/15 text-red-400 border-red-500/25"
                      : f.severity === "HIGH"   ? "bg-orange-500/15 text-orange-400 border-orange-500/25"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/25"
                    }`}>{f.severity}</span>
                    <div>
                      <div className="text-sm font-medium text-white/80 mb-1">{f.title}</div>
                      <div className="text-xs text-white/50 leading-relaxed">{f.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Attestation */}
        <div className="border border-white/[0.08] rounded-xl p-6 mb-8">
          <div className="text-sm font-medium text-white mb-3">Auditor Attestation</div>
          <p className="text-xs text-white/40 leading-relaxed mb-6">
            This report was generated by AgentLedger on {new Date(report.generatedAt!).toLocaleDateString()}.
            Authorization records contained herein have been cryptographically signed and their hashes anchored
            to the Solana blockchain, providing tamper-proof evidence of record integrity.
            {isFederal && " This report is structured for use in CMMC Level 2/3 assessment activities."}
          </p>
          <div className="grid grid-cols-3 gap-8">
            {["Authorized signatory", "Title / Role", "Date"].map((label) => (
              <div key={label}>
                <div className="h-8 border-b border-white/[0.08] mb-2" />
                <div className="text-[11px] text-white/25">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-white/20 pt-4 border-t border-white/[0.05]">
          <div>AgentLedger · {report.org.name} · Report {report.id.slice(-12)}</div>
          <div>CONFIDENTIAL — Authorized review only</div>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { token: string } }) {
  const report = await prisma.auditReport.findUnique({
    where: { id: params.token },
    include: { org: { select: { name: true } } },
  });
  if (!report) return { title: "Report not found" };
  return {
    title: `Audit Report — ${report.org.name}`,
    description: `AgentLedger compliance audit package for ${report.org.name}`,
    robots: "noindex", // Don't index compliance reports
  };
}
