"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Agent {
  id: string;
  agentName: string;
  walletAddress: string;
  walletChain: string;
  framework: string;
  status: string;
  createdAt: string;
  authorizationRecords: { version: number; onChainAnchorTx: string | null }[];
  _count: {
    authorizationRecords: number;
    auditSessions: number;
    policyFindings: number;
  };
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ orgId }) => {
        setOrgId(orgId);
        return fetch(`/api/orgs/${orgId}/agents`);
      })
      .then((r) => r.json())
      .then(({ agents }) => {
        setAgents(agents ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Agent wallets</h1>
          <p className="text-sm text-white/40 mt-1">
            {agents.length} wallet{agents.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Link
          href="/agents/new"
          className="text-sm bg-green-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-green-400 transition-colors"
        >
          + Register agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="border border-dashed border-white/[0.08] rounded-xl p-16 text-center">
          <div className="text-4xl mb-4 opacity-20">◈</div>
          <h2 className="text-base font-medium text-white/60 mb-2">No agent wallets yet</h2>
          <p className="text-sm text-white/30 mb-6 max-w-sm mx-auto">
            Register your first Solana agent wallet to start creating authorization records
            and generating audit packages.
          </p>
          <Link
            href="/agents/new"
            className="text-sm bg-green-500 text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-green-400 transition-colors"
          >
            Register first agent
          </Link>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Agent", "Wallet address", "Auth", "Framework", "Findings", ""].map((h) => (
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
              {agents.map((agent) => {
                const activeAuth = agent.authorizationRecords[0];
                return (
                  <tr key={agent.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-white">{agent.agentName}</div>
                      <div className="text-xs text-white/30 mt-0.5">
                        {new Date(agent.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-xs text-white/50 font-mono">
                        {agent.walletAddress.slice(0, 8)}…{agent.walletAddress.slice(-8)}
                      </code>
                      <div className="text-[10px] text-white/20 mt-0.5">{agent.walletChain}</div>
                    </td>
                    <td className="px-5 py-4">
                      {activeAuth ? (
                        <div>
                          <span className="text-[11px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                            v{activeAuth.version} active
                          </span>
                          {activeAuth.onChainAnchorTx && (
                            <div className="text-[10px] text-white/20 mt-1">⚓ anchored</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          unauthorized
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-white/40">
                        {agent.framework.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {agent._count.policyFindings > 0 ? (
                        <span className="text-[11px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                          {agent._count.policyFindings} open
                        </span>
                      ) : (
                        <span className="text-[11px] text-white/20">none</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/agents/${agent.id}`}
                        className="text-xs text-green-500 hover:text-green-400 transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
