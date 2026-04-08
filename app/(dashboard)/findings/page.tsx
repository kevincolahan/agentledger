"use client";

import { useState, useEffect, useCallback } from "react";

interface Finding {
  id: string;
  findingType: string;
  severity: string;
  title: string;
  description: string;
  txSignature: string | null;
  status: string;
  detectedAt: string;
  dispositionNotes: string | null;
  disposedAt: string | null;
  agentWallet: { agentName: string; walletAddress: string };
  authorization: { version: number; operationalPurpose: string } | null;
}

const SEV_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  LOW: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  INFO: "bg-white/5 text-white/40 border-white/10",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-red-500/10 text-red-400 border-red-500/20",
  ACKNOWLEDGED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REMEDIATED: "bg-green-500/10 text-green-400 border-green-500/20",
  ACCEPTED_RISK: "bg-white/5 text-white/40 border-white/10",
};

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "ACKNOWLEDGED" | "REMEDIATED">("OPEN");
  const [selected, setSelected] = useState<Finding | null>(null);
  const [disposeForm, setDisposeForm] = useState({ status: "ACKNOWLEDGED", notes: "" });
  const [disposing, setDisposing] = useState(false);
  const [scanning, setScanning] = useState(false);

  const fetchFindings = useCallback(async (oId: string, status?: string) => {
    const params = status && status !== "ALL" ? `?status=${status}` : "";
    const res = await fetch(`/api/orgs/${oId}/findings${params}`);
    const data = await res.json();
    setFindings(data.findings ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ orgId }) => {
        setOrgId(orgId);
        return fetchFindings(orgId, filter === "ALL" ? undefined : filter);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (orgId) fetchFindings(orgId, filter === "ALL" ? undefined : filter);
  }, [filter, orgId, fetchFindings]);

  async function handleRunScan() {
    setScanning(true);
    await fetch(`/api/orgs/${orgId}/findings`, { method: "POST" });
    setTimeout(() => {
      fetchFindings(orgId, filter === "ALL" ? undefined : filter);
      setScanning(false);
    }, 3000);
  }

  async function handleDispose(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setDisposing(true);

    await fetch(`/api/orgs/${orgId}/findings/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: disposeForm.status, dispositionNotes: disposeForm.notes }),
    });

    setSelected(null);
    setDisposeForm({ status: "ACKNOWLEDGED", notes: "" });
    setDisposing(false);
    fetchFindings(orgId, filter === "ALL" ? undefined : filter);
  }

  const openCount = findings.filter((f) => f.status === "OPEN").length;
  const criticalCount = findings.filter((f) => f.severity === "CRITICAL" && f.status === "OPEN").length;

  if (loading) return <div className="p-8"><div className="h-32 bg-white/[0.03] rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Policy findings</h1>
          <p className="text-sm text-white/40 mt-1">
            {openCount > 0
              ? `${openCount} open finding${openCount > 1 ? "s" : ""}${criticalCount > 0 ? ` — ${criticalCount} critical` : ""}`
              : "No open findings"}
          </p>
        </div>
        <button
          onClick={handleRunScan}
          disabled={scanning}
          className="text-sm bg-white/[0.06] text-white/70 font-medium px-4 py-2 rounded-lg
            hover:bg-white/[0.08] transition-colors disabled:opacity-40"
        >
          {scanning ? "Scanning…" : "Run scan now"}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["OPEN", "ACKNOWLEDGED", "REMEDIATED", "ALL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filter === f
                ? "bg-white/[0.08] border-white/20 text-white"
                : "bg-transparent border-white/[0.06] text-white/40 hover:text-white/60"
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {findings.length === 0 ? (
        <div className="border border-dashed border-white/[0.08] rounded-xl p-16 text-center">
          <div className="text-4xl mb-4 opacity-20">⚑</div>
          <h2 className="text-base font-medium text-white/60 mb-2">
            {filter === "OPEN" ? "No open findings" : "No findings"}
          </h2>
          <p className="text-sm text-white/30 max-w-sm mx-auto">
            {filter === "OPEN"
              ? "All agent activity is within documented authorization scope. Run a scan to check for new issues."
              : "Run a policy scan to analyze recent agent activity against authorization records."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((finding) => (
            <div
              key={finding.id}
              className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${SEV_STYLES[finding.severity]}`}>
                    {finding.severity}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white mb-1">{finding.title}</div>
                    <div className="text-xs text-white/50 leading-relaxed">{finding.description}</div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[11px] text-white/30">
                        {finding.agentWallet.agentName}
                      </span>
                      {finding.txSignature && (
                        <a
                          href={`https://solscan.io/tx/${finding.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-400/70 hover:text-blue-400 font-mono"
                        >
                          {finding.txSignature.slice(0, 12)}…
                        </a>
                      )}
                      <span className="text-[11px] text-white/20">
                        {new Date(finding.detectedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {finding.dispositionNotes && (
                      <div className="mt-2 text-[11px] text-white/30 italic">
                        Disposition: {finding.dispositionNotes}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[finding.status]}`}>
                    {finding.status.toLowerCase().replace("_", " ")}
                  </span>
                  {finding.status === "OPEN" && (
                    <button
                      onClick={() => { setSelected(finding); setDisposeForm({ status: "ACKNOWLEDGED", notes: "" }); }}
                      className="text-xs text-white/50 hover:text-white transition-colors border border-white/[0.08] px-3 py-1 rounded-lg hover:border-white/20"
                    >
                      Dispose
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disposition modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/[0.1] rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-white mb-1">Dispose finding</h2>
            <p className="text-sm text-white/40 mb-5">{selected.title}</p>

            <form onSubmit={handleDispose} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-2">Disposition</label>
                <div className="space-y-2">
                  {[
                    { value: "ACKNOWLEDGED", label: "Acknowledged", desc: "Noted, being investigated" },
                    { value: "REMEDIATED", label: "Remediated", desc: "Root cause fixed" },
                    { value: "ACCEPTED_RISK", label: "Accepted risk", desc: "Risk formally accepted" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDisposeForm((f) => ({ ...f, status: opt.value }))}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        disposeForm.status === opt.value
                          ? "bg-green-500/15 border-green-500/40 text-green-400"
                          : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/15"
                      }`}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-white/30 ml-2">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1.5">Disposition notes</label>
                <textarea
                  value={disposeForm.notes}
                  onChange={(e) => setDisposeForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  required
                  minLength={5}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white
                    placeholder-white/20 focus:outline-none focus:border-green-500/50 resize-none"
                  placeholder="Describe the disposition rationale. This note will appear in the audit report."
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={disposing || !disposeForm.notes.trim()}
                  className="bg-green-500 text-black font-semibold text-sm px-5 py-2 rounded-lg
                    hover:bg-green-400 transition-colors disabled:opacity-40"
                >
                  {disposing ? "Saving…" : "Save disposition"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-sm text-white/40 hover:text-white/60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
