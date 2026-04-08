"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Finding {
  id: string;
  title: string;
  severity: string;
  findingType: string;
  status: string;
  detectedAt: string;
  agentWallet: { agentName: string };
}

interface ScanStatus {
  scanning: boolean;
  lastRun?: string;
  openFindings: number;
  criticalFindings: number;
  recentFindings: Finding[];
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-amber-400",
  LOW: "text-blue-400",
};

export default function PolicyPage() {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [scanMessage, setScanMessage] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ orgId }) => {
        setOrgId(orgId);
        return loadStatus(orgId);
      });
  }, []);

  async function loadStatus(oId: string) {
    setLoading(true);
    const res = await fetch(`/api/orgs/${oId}/findings?status=OPEN`);
    const data = await res.json();
    const findings: Finding[] = data.findings ?? [];
    setStatus({
      scanning: false,
      openFindings: findings.length,
      criticalFindings: findings.filter((f) => f.severity === "CRITICAL").length,
      recentFindings: findings.slice(0, 8),
    });
    setLoading(false);
  }

  async function runScan() {
    setRunning(true);
    setScanMessage("Scan started — checking agent activity against authorization records…");
    await fetch(`/api/orgs/${orgId}/findings`, { method: "POST" });
    // Wait for scan to process and reload
    setTimeout(async () => {
      await loadStatus(orgId);
      setScanMessage("");
      setRunning(false);
    }, 5000);
  }

  const FINDING_TYPES: Record<string, string> = {
    EXCEEDED_TX_LIMIT: "Transaction limit exceeded",
    EXCEEDED_DAILY_LIMIT: "Daily spend limit exceeded",
    UNAUTHORIZED_PROGRAM: "Unauthorized program invoked",
    ANOMALOUS_FREQUENCY: "Anomalous transaction frequency",
    NO_ACTIVE_AUTHORIZATION: "No active authorization",
    REASONING_MISMATCH: "Reasoning inconsistency (Claude)",
  };

  if (loading) return <div className="p-8"><div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold text-white">Policy engine</h1>
          <p className="text-sm text-white/40 mt-1">
            Automated compliance scanning against authorization records
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={running}
          className="text-sm bg-green-500 text-black font-semibold px-4 py-2 rounded-lg
            hover:bg-green-400 transition-colors disabled:opacity-50"
        >
          {running ? "Scanning…" : "Run scan now"}
        </button>
      </div>

      {scanMessage && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-3.5 mb-6">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <p className="text-sm text-blue-400">{scanMessage}</p>
        </div>
      )}

      {/* Engine overview */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className={`text-2xl font-semibold mb-1 ${status!.criticalFindings > 0 ? "text-red-400" : "text-white"}`}>
            {status!.criticalFindings}
          </div>
          <div className="text-xs text-white/40">Critical findings</div>
          <div className="text-[10px] text-white/20 mt-0.5">require immediate action</div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className={`text-2xl font-semibold mb-1 ${status!.openFindings > 0 ? "text-amber-400" : "text-green-400"}`}>
            {status!.openFindings}
          </div>
          <div className="text-xs text-white/40">Open findings</div>
          <div className="text-[10px] text-white/20 mt-0.5">across all agents</div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="text-2xl font-semibold mb-1 text-white/60">2:00 AM</div>
          <div className="text-xs text-white/40">Nightly scan</div>
          <div className="text-[10px] text-white/20 mt-0.5">UTC · runs automatically</div>
        </div>
      </div>

      {/* Scan rules */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-white mb-4">Active scan rules</h2>
        <div className="space-y-3">
          {[
            { rule: "Transaction limit check", desc: "Flags any transaction exceeding max_tx_value_usd in the active authorization", type: "rule-based", severity: "HIGH" },
            { rule: "Daily spend limit check", desc: "Aggregates 24-hour spend and flags when max_daily_spend_usd is exceeded", type: "rule-based", severity: "HIGH" },
            { rule: "Unauthorized program check", desc: "Flags transactions invoking programs not in the whitelist", type: "rule-based", severity: "HIGH" },
            { rule: "No active authorization", desc: "Critical alert when an agent transacts without a current authorization record", type: "rule-based", severity: "CRITICAL" },
            { rule: "Anomaly detection (frequency)", desc: "Flags agents with >50 transactions in 24 hours for manual review", type: "rule-based", severity: "MEDIUM" },
            { rule: "Reasoning consistency (Claude)", desc: "AI analysis of whether stated agent reasoning is consistent with actions taken", type: "claude", severity: "MEDIUM" },
          ].map((r) => (
            <div key={r.rule} className="flex items-start justify-between py-3 border-b border-white/[0.04] last:border-0">
              <div className="flex items-start gap-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border mt-0.5 flex-shrink-0 ${
                  r.type === "claude"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}>
                  {r.type === "claude" ? "Claude" : "Rule"}
                </span>
                <div>
                  <div className="text-sm font-medium text-white/80">{r.rule}</div>
                  <div className="text-xs text-white/40 mt-0.5 leading-relaxed">{r.desc}</div>
                </div>
              </div>
              <span className={`text-[11px] flex-shrink-0 ml-4 mt-0.5 ${SEV_COLOR[r.severity]}`}>
                {r.severity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent open findings */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-white">Open findings</h2>
        <Link href="/findings" className="text-xs text-green-500 hover:text-green-400">
          View all + dispose →
        </Link>
      </div>

      {status!.recentFindings.length === 0 ? (
        <div className="border border-dashed border-white/[0.07] rounded-xl p-10 text-center">
          <div className="text-3xl mb-3 opacity-20">✓</div>
          <p className="text-sm text-white/40">No open findings. All agents are operating within authorization scope.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {status!.recentFindings.map((f) => (
            <div key={f.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[11px] font-semibold flex-shrink-0 ${SEV_COLOR[f.severity]}`}>
                  {f.severity}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-white/80 font-medium truncate">{f.title}</div>
                  <div className="text-xs text-white/30 mt-0.5">
                    {f.agentWallet.agentName} · {FINDING_TYPES[f.findingType] ?? f.findingType} ·{" "}
                    {new Date(f.detectedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <Link
                href="/findings"
                className="text-xs text-white/30 hover:text-white/60 transition-colors ml-4 flex-shrink-0"
              >
                Dispose →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
