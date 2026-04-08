"use client";

import { useState, useEffect, useCallback } from "react";

interface Report {
  id: string;
  reportType: string;
  reportFormat: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  agentCount: number | null;
  findingCount: number | null;
  generatedAt: string | null;
  r2Url: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

const FORMAT_LABELS: Record<string, { label: string; desc: string }> = {
  STANDARD: { label: "Standard", desc: "General enterprise audit package" },
  FEDERAL: { label: "Federal / CMMC", desc: "NIST SP 800-53 language, CMMC assessment ready" },
  CPA: { label: "CPA / Tax", desc: "Tax practitioner format with per-wallet cost basis" },
};

const TYPE_LABELS: Record<string, string> = {
  FULL_AUDIT_PACKAGE: "Full audit package",
  COMPLIANCE_ONLY: "Compliance only",
  TAX_POSITION: "Tax position",
  FINDINGS_SUMMARY: "Findings summary",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [polling, setPolling] = useState<string | null>(null);

  const [form, setForm] = useState({
    reportType: "FULL_AUDIT_PACKAGE",
    reportFormat: "STANDARD",
    periodStart: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    periodEnd: new Date().toISOString().split("T")[0],
  });

  const fetchReports = useCallback(async (oId: string) => {
    const res = await fetch(`/api/orgs/${oId}/reports`);
    const data = await res.json();
    setReports(data.reports ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ orgId }) => {
        setOrgId(orgId);
        return fetchReports(orgId);
      })
      .finally(() => setLoading(false));
  }, [fetchReports]);

  // Poll for in-progress report
  useEffect(() => {
    if (!polling || !orgId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/orgs/${orgId}/reports/${polling}`);
      const { report } = await res.json();
      if (report.status === "COMPLETE" || report.status === "FAILED") {
        setPolling(null);
        setGenerating(false);
        fetchReports(orgId);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, orgId, fetchReports]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);

    const res = await fetch(`/api/orgs/${orgId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        periodStart: new Date(form.periodStart).toISOString(),
        periodEnd: new Date(form.periodEnd + "T23:59:59Z").toISOString(),
      }),
    });

    const data = await res.json();
    setShowForm(false);
    setPolling(data.report.id);
    fetchReports(orgId);
  }

  if (loading) {
    return <div className="p-8"><div className="h-32 bg-white/[0.03] rounded-xl animate-pulse" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Audit reports</h1>
          <p className="text-sm text-white/40 mt-1">
            Generate compliance packages, tax reports, and findings summaries
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-green-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-green-400 transition-colors"
        >
          + Generate report
        </button>
      </div>

      {/* Generation form */}
      {showForm && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-5">New report</h2>
          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Report type */}
            <div>
              <label className="block text-xs text-white/40 mb-2">Report type</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, reportType: val }))}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      form.reportType === val
                        ? "bg-green-500/15 border-green-500/40 text-green-400"
                        : "bg-white/[0.02] border-white/[0.06] text-white/50 hover:border-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs text-white/40 mb-2">Output format</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(FORMAT_LABELS).map(([val, { label, desc }]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, reportFormat: val }))}
                    className={`text-left px-3 py-2.5 rounded-lg border transition-all ${
                      form.reportFormat === val
                        ? "bg-green-500/15 border-green-500/40"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    <div className={`text-xs font-medium mb-0.5 ${form.reportFormat === val ? "text-green-400" : "text-white/70"}`}>
                      {label}
                    </div>
                    <div className="text-[10px] text-white/30">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Period start</label>
                <input
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white
                    focus:outline-none focus:border-green-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Period end</label>
                <input
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white
                    focus:outline-none focus:border-green-500/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={generating}
                className="bg-green-500 text-black font-semibold text-sm px-5 py-2 rounded-lg
                  hover:bg-green-400 transition-colors disabled:opacity-40"
              >
                {generating ? "Generating…" : "Generate PDF"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-white/40 hover:text-white/60"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Generating indicator */}
      {polling && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-4 mb-6">
          <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-blue-400">Generating report…</div>
            <div className="text-xs text-white/40 mt-0.5">
              Compiling authorization records, findings, and on-chain verification proofs. Usually takes 10–30 seconds.
            </div>
          </div>
        </div>
      )}

      {/* Reports list */}
      {reports.length === 0 && !polling ? (
        <div className="border border-dashed border-white/[0.08] rounded-xl p-16 text-center">
          <div className="text-4xl mb-4 opacity-20">⊞</div>
          <h2 className="text-base font-medium text-white/60 mb-2">No reports yet</h2>
          <p className="text-sm text-white/30 max-w-sm mx-auto">
            Generate your first audit package to produce a downloadable PDF with authorization records,
            policy findings, and an auditor attestation page.
          </p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Report", "Period", "Format", "Agents", "Findings", "Size", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] text-white/30 font-medium uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-white">
                      {TYPE_LABELS[report.reportType] ?? report.reportType}
                    </div>
                    <div className="text-[10px] text-white/20 font-mono mt-0.5">{report.id.slice(-8)}</div>
                  </td>
                  <td className="px-5 py-4 text-xs text-white/50">
                    {new Date(report.periodStart).toLocaleDateString()} –
                    <br />
                    {new Date(report.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[11px] text-white/50">
                      {FORMAT_LABELS[report.reportFormat]?.label ?? report.reportFormat}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-white/50">{report.agentCount ?? "—"}</td>
                  <td className="px-5 py-4">
                    {report.findingCount != null ? (
                      <span
                        className={`text-xs ${
                          report.findingCount > 0 ? "text-amber-400" : "text-green-400"
                        }`}
                      >
                        {report.findingCount}
                      </span>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-white/40">
                    {report.fileSizeBytes
                      ? `${(report.fileSizeBytes / 1024).toFixed(0)}KB`
                      : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        report.status === "COMPLETE"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : report.status === "GENERATING"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : report.status === "FAILED"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-white/5 text-white/40 border-white/10"
                      }`}
                    >
                      {report.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {report.status === "COMPLETE" && report.r2Url && (
                      <a
                        href={report.r2Url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-green-500 hover:text-green-400 transition-colors"
                      >
                        Download PDF →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
