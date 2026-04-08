import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());

export default async function AdminMetricsPage() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    redirect("/agents");
  }

  const now         = new Date();
  const thirtyDays  = new Date(now.getTime() - 30  * 86400 * 1000);
  const sevenDays   = new Date(now.getTime() - 7   * 86400 * 1000);
  const yesterday   = new Date(now.getTime() - 1   * 86400 * 1000);

  const [
    totalOrgs,
    activeOrgs,
    newOrgs30d,
    newOrgs7d,
    totalAgents,
    totalReports,
    starterCount,
    proCount,
    entCount,
    recentSignups,
    recentReports,
    outreachMetrics,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { agentWallets: { some: { status: "ACTIVE" } } } }),
    prisma.organization.count({ where: { createdAt: { gte: thirtyDays } } }),
    prisma.organization.count({ where: { createdAt: { gte: sevenDays } } }),
    prisma.agentWallet.count({ where: { status: "ACTIVE" } }),
    prisma.auditReport.count({ where: { status: "COMPLETE" } }),
    prisma.organization.count({ where: { planTier: "STARTER" } }),
    prisma.organization.count({ where: { planTier: "PROFESSIONAL" } }),
    prisma.organization.count({ where: { planTier: "ENTERPRISE" } }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true, planTier: true, createdAt: true, _count: { select: { agentWallets: true } } },
    }),
    prisma.auditReport.findMany({
      where: { status: "COMPLETE", generatedAt: { gte: thirtyDays } },
      orderBy: { generatedAt: "desc" },
      take: 10,
      select: { reportType: true, reportFormat: true, generatedAt: true, org: { select: { name: true } } },
    }),
    prisma.marketingMetric.findMany({
      where: { date: { gte: thirtyDays } },
      orderBy: { date: "desc" },
    }),
  ]);

  // Estimated MRR
  const mrrEstimate = proCount * 199 + entCount * 999;

  // Outreach stats
  const emailsSent   = outreachMetrics.filter((m) => m.metric === "outreach_run").reduce((s, m) => s + m.value, 0);
  const emailOpened  = outreachMetrics.filter((m) => m.metric === "email_opened").length;
  const mentionsFound = outreachMetrics.filter((m) => m.metric === "monitor_run").reduce((s, m) => s + m.value, 0);

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const fmtUsd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="text-xs text-white/30 mb-2">
            <a href="/admin" className="hover:text-white/60">← Admin</a>
          </div>
          <h1 className="text-xl font-semibold">Product metrics</h1>
          <p className="text-sm text-white/40 mt-0.5">Live stats from Railway Postgres</p>
        </div>

        {/* MRR + key metrics */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: "Est. MRR",      value: fmtUsd(mrrEstimate), color: "text-green-400" },
            { label: "Total orgs",    value: fmt(totalOrgs),      color: "text-white" },
            { label: "New (30d)",     value: `+${fmt(newOrgs30d)}`, color: "text-blue-400" },
            { label: "Active agents", value: fmt(totalAgents),    color: "text-white" },
            { label: "Reports gen.",  value: fmt(totalReports),   color: "text-white" },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className={`text-xl font-semibold mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Plan breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { tier: "Starter",      count: starterCount, price: "$49",  mrr: starterCount * 49,  color: "text-white/50" },
            { tier: "Professional", count: proCount,     price: "$199", mrr: proCount * 199,      color: "text-blue-400" },
            { tier: "Enterprise",   count: entCount,     price: "$999", mrr: entCount * 999,      color: "text-green-400" },
          ].map((p) => (
            <div key={p.tier} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold ${p.color}`}>{p.tier}</span>
                <span className="text-xs text-white/30">{p.price}/mo</span>
              </div>
              <div className="text-2xl font-semibold text-white mb-0.5">{p.count}</div>
              <div className="text-xs text-white/30">orgs · {fmtUsd(p.mrr)} MRR</div>
              <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500/40 rounded-full"
                  style={{ width: `${totalOrgs ? (p.count / totalOrgs) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Recent signups */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-medium text-white">Recent signups</h2>
              <p className="text-xs text-white/30 mt-0.5">Last 10 organizations</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {recentSignups.map((org, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm text-white/80">{org.name}</div>
                    <div className="text-xs text-white/30 mt-0.5">
                      {org._count.agentWallets} wallet{org._count.agentWallets !== 1 ? "s" : ""} ·{" "}
                      {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`text-[11px] border px-2 py-0.5 rounded-full ${
                    org.planTier === "ENTERPRISE" ? "text-green-400 border-green-500/25" :
                    org.planTier === "PROFESSIONAL" ? "text-blue-400 border-blue-500/25" :
                    "text-white/30 border-white/10"
                  }`}>
                    {org.planTier.toLowerCase()}
                  </span>
                </div>
              ))}
              {recentSignups.length === 0 && (
                <div className="px-5 py-6 text-sm text-white/30 text-center">No signups yet</div>
              )}
            </div>
          </div>

          {/* Marketing stats + recent reports */}
          <div className="space-y-4">
            {/* Marketing */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-sm font-medium text-white mb-4">Marketing (30d)</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Emails sent",      value: fmt(emailsSent) },
                  { label: "Opens tracked",    value: fmt(emailOpened) },
                  { label: "Mentions found",   value: fmt(mentionsFound) },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-lg font-semibold text-white">{s.value}</div>
                    <div className="text-[11px] text-white/30 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent reports */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-medium text-white">Recent reports (30d)</h2>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {recentReports.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-xs text-white/70">{r.org.name}</div>
                      <div className="text-[11px] text-white/30 mt-0.5">
                        {r.reportType.replace(/_/g, " ").toLowerCase()} · {r.reportFormat}
                      </div>
                    </div>
                    <div className="text-[11px] text-white/30">
                      {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                ))}
                {recentReports.length === 0 && (
                  <div className="px-5 py-6 text-sm text-white/30 text-center">No reports yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
