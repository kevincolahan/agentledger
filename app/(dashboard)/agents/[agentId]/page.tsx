"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface AuthRecord {
  id: string;
  version: number;
  operationalPurpose: string;
  maxTxValueUsd: string | null;
  maxDailySpendUsd: string | null;
  whitelistedPrograms: string[];
  permittedTxTypes: string[];
  orgSignerPubkey: string;
  recordHash: string;
  onChainAnchorTx: string | null;
  anchoredAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  signature: string;
}

interface AuditSession {
  id: string;
  sessionStart: string;
  sessionEnd: string | null;
  logCount: number;
  merkleRoot: string | null;
  onChainAnchorTx: string | null;
  status: string;
}

interface PolicyFinding {
  id: string;
  findingType: string;
  severity: string;
  title: string;
  description: string;
  txSignature: string | null;
  status: string;
  detectedAt: string;
}

interface Agent {
  id: string;
  agentName: string;
  agentDescription: string | null;
  walletAddress: string;
  walletChain: string;
  framework: string;
  registryAgentId: string | null;
  status: string;
  createdAt: string;
  authorizationRecords: AuthRecord[];
  auditSessions: AuditSession[];
  policyFindings: PolicyFinding[];
  _count: { authorizationRecords: number; auditSessions: number; policyFindings: number; taxEvents: number };
}

const SEV: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  LOW: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [tab, setTab] = useState<"overview" | "authorizations" | "sessions" | "findings">("overview");
  const [suspending, setSuspending] = useState(false);
  const justCreated = searchParams.get("created") === "1";

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ orgId }) => {
        setOrgId(orgId);
        return fetch(`/api/orgs/${orgId}/agents/${params.agentId}`);
      })
      .then((r) => r.json())
      .then(({ agent }) => { setAgent(agent); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.agentId]);

  async function toggleSuspend() {
    if (!agent) return;
    setSuspending(true);
    const newStatus = agent.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await fetch(`/api/orgs/${orgId}/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setAgent((a) => a ? { ...a, status: newStatus } : a);
    setSuspending(false);
  }

  if (loading) return <div className="p-8"><div className="h-48 bg-white/[0.03] rounded-xl animate-pulse" /></div>;
  if (!agent) return <div className="p-8 text-white/40">Agent not found.</div>;

  const activeAuth = agent.authorizationRecords.find((r) => !r.effectiveTo);

  return (
    <div className="p-8">
      {/* Created banner */}
      {justCreated && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3.5 mb-6">
          <span className="text-green-400">✓</span>
          <div>
            <span className="text-sm font-medium text-green-400">Authorization record created</span>
            <span className="text-xs text-white/40 ml-2">On-chain anchoring is processing in the background.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push("/agents")}
              className="text-xs text-white/30 hover:text-white/60 transition-colors">← Agents</button>
            <span className="text-white/20">·</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                agent.status === "ACTIVE"
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {agent.status.toLowerCase()}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white">{agent.agentName}</h1>
          <p className="text-xs text-white/30 font-mono mt-1">{agent.walletAddress}</p>
          {agent.agentDescription && (
            <p className="text-sm text-white/40 mt-1.5">{agent.agentDescription}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/agents/${agent.id}/authorizations/new`}
            className="text-xs bg-green-500 text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-green-400 transition-colors"
          >
            + New authorization
          </Link>
          <button
            onClick={toggleSuspend}
            disabled={suspending}
            className="text-xs bg-white/[0.05] text-white/50 px-3 py-1.5 rounded-lg hover:bg-white/[0.08] transition-colors border border-white/[0.06]"
          >
            {agent.status === "ACTIVE" ? "Suspend" : "Reactivate"}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        {[
          { label: "Auth records", value: agent._count.authorizationRecords, active: activeAuth ? `v${activeAuth.version} active` : "none active" },
          { label: "Audit sessions", value: agent._count.auditSessions, active: null },
          { label: "Open findings", value: agent.policyFindings.length, active: agent.policyFindings.length > 0 ? "need review" : "all clear", warn: agent.policyFindings.length > 0 },
          { label: "Tax events", value: agent._count.taxEvents, active: null },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 border ${stat.warn ? "bg-amber-500/5 border-amber-500/20" : "bg-white/[0.02] border-white/[0.05]"}`}>
            <div className={`text-xl font-semibold mb-1 ${stat.warn ? "text-amber-400" : "text-white"}`}>{stat.value}</div>
            <div className="text-xs text-white/40">{stat.label}</div>
            {stat.active && <div className={`text-[10px] mt-0.5 ${stat.warn ? "text-amber-400/60" : "text-white/20"}`}>{stat.active}</div>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06] pb-0">
        {(["overview", "authorizations", "sessions", "findings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm transition-all border-b-2 -mb-px ${
              tab === t
                ? "border-green-500 text-white font-medium"
                : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "findings" && agent.policyFindings.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                {agent.policyFindings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          {/* Active authorization */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white">Active authorization</h2>
              {activeAuth && (
                <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                  v{activeAuth.version}
                </span>
              )}
            </div>

            {activeAuth ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] text-white/30 mb-1">Purpose</div>
                  <div className="text-xs text-white/70 leading-relaxed">{activeAuth.operationalPurpose}</div>
                </div>
                {activeAuth.maxTxValueUsd && (
                  <Row label="Max per tx" value={`$${Number(activeAuth.maxTxValueUsd).toLocaleString()} USD`} />
                )}
                {activeAuth.maxDailySpendUsd && (
                  <Row label="Max daily" value={`$${Number(activeAuth.maxDailySpendUsd).toLocaleString()} USD`} />
                )}
                <Row label="Tx types" value={activeAuth.permittedTxTypes.join(", ") || "—"} />
                <Row label="Effective" value={new Date(activeAuth.effectiveFrom).toLocaleDateString()} />

                {/* On-chain anchor */}
                <div className="mt-3 pt-3 border-t border-white/[0.05]">
                  {activeAuth.onChainAnchorTx ? (
                    <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-3">
                      <div className="text-[10px] font-medium text-green-400 mb-1.5">⚓ On-chain anchor verified</div>
                      <a
                        href={`https://solscan.io/tx/${activeAuth.onChainAnchorTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors break-all"
                      >
                        {activeAuth.onChainAnchorTx}
                      </a>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                      <div className="text-[10px] text-white/30 animate-pulse">⚓ Anchoring in progress…</div>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <div className="text-[10px] text-white/20 font-mono break-all">Hash: {activeAuth.recordHash}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/30 mb-4">No active authorization record</p>
                <Link
                  href={`/agents/${agent.id}/authorizations/new`}
                  className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors"
                >
                  Create first authorization →
                </Link>
              </div>
            )}
          </div>

          {/* Agent details */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-4">Agent details</h2>
            <div className="space-y-3">
              <Row label="Wallet" value={`${agent.walletAddress.slice(0, 16)}…${agent.walletAddress.slice(-8)}`} mono />
              <Row label="Chain" value={agent.walletChain} />
              <Row label="Framework" value={agent.framework.replace(/_/g, " ").toLowerCase()} />
              <Row label="Registered" value={new Date(agent.createdAt).toLocaleDateString()} />
              {agent.registryAgentId && (
                <Row label="Registry ID" value={`${agent.registryAgentId.slice(0, 20)}…`} mono />
              )}
              <div className="pt-3 border-t border-white/[0.05]">
                <a
                  href={`https://solscan.io/account/${agent.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
                >
                  View on Solscan →
                </a>
                {agent.registryAgentId && (
                  <a
                    href={`https://solana.com/agent-registry/${agent.registryAgentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors ml-4"
                  >
                    View in Agent Registry →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "authorizations" && (
        <div className="space-y-4">
          {agent.authorizationRecords.length === 0 ? (
            <EmptyState message="No authorization records yet" action={{ href: `/agents/${agent.id}/authorizations/new`, label: "Create first authorization" }} />
          ) : (
            agent.authorizationRecords.map((auth) => (
              <div key={auth.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Authorization v{auth.version}</span>
                    {!auth.effectiveTo && (
                      <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">active</span>
                    )}
                  </div>
                  <span className="text-xs text-white/30">{new Date(auth.effectiveFrom).toLocaleDateString()}</span>
                </div>
                <div className="space-y-2.5">
                  <Row label="Purpose" value={auth.operationalPurpose} />
                  {auth.maxTxValueUsd && <Row label="Max tx" value={`$${Number(auth.maxTxValueUsd).toLocaleString()}`} />}
                  {auth.maxDailySpendUsd && <Row label="Max daily" value={`$${Number(auth.maxDailySpendUsd).toLocaleString()}`} />}
                  <Row label="Tx types" value={auth.permittedTxTypes.join(", ") || "—"} />
                  {auth.whitelistedPrograms.length > 0 && (
                    <Row label="Programs" value={`${auth.whitelistedPrograms.length} whitelisted`} />
                  )}
                  <div className="pt-2 border-t border-white/[0.05]">
                    <Row label="Record hash" value={auth.recordHash} mono small />
                    {auth.onChainAnchorTx ? (
                      <div className="mt-2">
                        <Row label="Anchor tx" value={auth.onChainAnchorTx} mono small link={`https://solscan.io/tx/${auth.onChainAnchorTx}`} />
                      </div>
                    ) : (
                      <div className="text-[10px] text-white/20 mt-2 animate-pulse">Anchoring pending…</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "sessions" && (
        <div>
          {agent.auditSessions.length === 0 ? (
            <EmptyState message="No audit sessions yet. Install the SDK to start capturing agent activity." />
          ) : (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Started", "Duration", "Events", "Status", "Merkle root", "Anchor"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] text-white/30 font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {agent.auditSessions.map((s) => {
                    const duration = s.sessionEnd
                      ? Math.round((new Date(s.sessionEnd).getTime() - new Date(s.sessionStart).getTime()) / 1000)
                      : null;
                    return (
                      <tr key={s.id}>
                        <td className="px-5 py-3.5 text-xs text-white/60">{new Date(s.sessionStart).toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-xs text-white/40">{duration != null ? `${duration}s` : "running"}</td>
                        <td className="px-5 py-3.5 text-xs text-white/60">{s.logCount}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            s.status === "ANCHORED" ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : s.status === "CLOSED" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-white/5 text-white/30 border-white/10"
                          }`}>{s.status.toLowerCase()}</span>
                        </td>
                        <td className="px-5 py-3.5 text-[10px] font-mono text-white/25">
                          {s.merkleRoot ? `${s.merkleRoot.slice(0, 16)}…` : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          {s.onChainAnchorTx ? (
                            <a href={`https://solscan.io/tx/${s.onChainAnchorTx}`} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-green-400/70 hover:text-green-400 font-mono">
                              {s.onChainAnchorTx.slice(0, 10)}… ↗
                            </a>
                          ) : <span className="text-[10px] text-white/20">pending</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "findings" && (
        <div className="space-y-3">
          {agent.policyFindings.length === 0 ? (
            <EmptyState message="No open policy findings for this agent." />
          ) : (
            agent.policyFindings.map((f) => (
              <div key={f.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${SEV[f.severity] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                    {f.severity}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-white mb-1">{f.title}</div>
                    <div className="text-xs text-white/50 leading-relaxed">{f.description}</div>
                    {f.txSignature && (
                      <a href={`https://solscan.io/tx/${f.txSignature}`} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-mono text-blue-400/60 hover:text-blue-400 mt-2 block">
                        {f.txSignature.slice(0, 20)}… ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {agent.policyFindings.length > 0 && (
            <Link href="/findings" className="text-xs text-green-500 hover:text-green-400 block text-center mt-2">
              Manage all findings →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({
  label,
  value,
  mono,
  small,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  link?: string;
}) {
  const valueEl = (
    <span className={`${mono ? "font-mono" : ""} ${small ? "text-[10px]" : "text-xs"} text-white/60 break-all`}>
      {value}
    </span>
  );
  return (
    <div className="flex items-start gap-4">
      <span className="text-[11px] text-white/30 min-w-[80px] flex-shrink-0 mt-px">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="text-xs font-mono text-blue-400/70 hover:text-blue-400 break-all">
          {value} ↗
        </a>
      ) : valueEl}
    </div>
  );
}

function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="border border-dashed border-white/[0.07] rounded-xl p-12 text-center">
      <p className="text-sm text-white/30 mb-4">{message}</p>
      {action && (
        <Link
          href={action.href}
          className="text-xs text-green-500 hover:text-green-400 transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
