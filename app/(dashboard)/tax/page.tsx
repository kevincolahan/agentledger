"use client";

import { useState, useEffect } from "react";

interface WalletTax {
  walletAddress: string;
  agentName: string;
  taxYear: number;
  ordinaryIncomeUsd: number;
  realizedGainsUsd: number;
  realizedLossesUsd: number;
  txFeesUsd: number;
  eventCount: number;
}

interface TaxPosition {
  taxYear: number;
  walletCount: number;
  wallets: WalletTax[];
  totals: {
    ordinaryIncomeUsd: number;
    realizedGainsUsd: number;
    realizedLossesUsd: number;
    txFeesUsd: number;
  };
  disclaimer: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function TaxPage() {
  const [position, setPosition] = useState<TaxPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ orgId }) => { setOrgId(orgId); return loadPosition(orgId, year); });
  }, []);

  async function loadPosition(oId: string, y: number) {
    setLoading(true);
    const res = await fetch(`/api/orgs/${oId}/tax?year=${y}`);
    const data = await res.json();
    setPosition(data.position ?? null);
    setLoading(false);
  }

  async function handleYearChange(y: number) {
    setYear(y);
    if (orgId) loadPosition(orgId, y);
  }

  async function handleSync() {
    setSyncing(true);
    await fetch(`/api/orgs/${orgId}/tax?year=${year}`, { method: "POST" });
    // Poll after 10 seconds
    setTimeout(() => {
      loadPosition(orgId, year).finally(() => setSyncing(false));
    }, 10_000);
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  if (loading) return (
    <div className="p-8 space-y-4 animate-pulse">
      <div className="h-7 w-48 bg-white/[0.04] rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/[0.03] rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold text-white">Tax positions</h1>
          <p className="text-sm text-white/40 mt-1">
            Per-wallet cost basis · IRS Rev. Proc. 2024-28 (effective Jan 1, 2026)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
            {[CURRENT_YEAR - 1, CURRENT_YEAR].map((y) => (
              <button
                key={y}
                onClick={() => handleYearChange(y)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                  year === y
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || !orgId}
            className="text-xs bg-white/[0.06] text-white/60 px-4 py-2 rounded-lg
              hover:bg-white/[0.08] transition-colors border border-white/[0.06] disabled:opacity-40"
          >
            {syncing ? "Syncing from Helius…" : "Sync transactions"}
          </button>
        </div>
      </div>

      {/* CPA disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-3.5 mb-6">
        <p className="text-xs text-amber-400/80 leading-relaxed">
          <span className="font-semibold">For CPA review only.</span> This data is provided to assist
          your tax practitioner. AgentLedger is not a licensed tax advisor. Consult a qualified
          professional before filing. USD values use estimated prices — your CPA should verify
          historical fair market values.
        </p>
      </div>

      {position && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-4 gap-4 mb-7">
            {[
              { label: "Ordinary income", value: position.totals.ordinaryIncomeUsd, note: "Staking + API fees", color: "text-white" },
              { label: "Realized gains", value: position.totals.realizedGainsUsd, note: "Swap gains", color: "text-green-400" },
              { label: "Realized losses", value: position.totals.realizedLossesUsd, note: "Swap losses (deductible)", color: "text-red-400" },
              { label: "Tx fees", value: position.totals.txFeesUsd, note: "Business expense", color: "text-white/60" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                <div className={`text-xl font-semibold mb-1 ${stat.color}`}>{fmt(stat.value)}</div>
                <div className="text-xs text-white/40">{stat.label}</div>
                <div className="text-[10px] text-white/20 mt-0.5">{stat.note}</div>
              </div>
            ))}
          </div>

          {/* Net capital gain/loss */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Net capital gain / loss</div>
              <div className="text-xs text-white/30 mt-0.5">
                Realized gains minus realized losses — reported on Schedule D
              </div>
            </div>
            <div className={`text-2xl font-semibold ${
              position.totals.realizedGainsUsd - position.totals.realizedLossesUsd >= 0
                ? "text-green-400"
                : "text-red-400"
            }`}>
              {fmt(position.totals.realizedGainsUsd - position.totals.realizedLossesUsd)}
            </div>
          </div>

          {/* Per-wallet breakdown */}
          <h2 className="text-sm font-medium text-white mb-4">Per-wallet breakdown</h2>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden mb-6">
            {position.wallets.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-white/30">
                No tax events found for {year}. Sync transactions to populate.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Agent wallet", "Ordinary income", "Cap gains", "Cap losses", "Net gain/loss", "Tx fees", "Events"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] text-white/30 font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {position.wallets.map((w) => {
                    const netGl = w.realizedGainsUsd - w.realizedLossesUsd;
                    return (
                      <tr key={w.walletAddress} className="hover:bg-white/[0.01]">
                        <td className="px-4 py-3.5">
                          <div className="text-sm font-medium text-white">{w.agentName}</div>
                          <div className="text-[10px] font-mono text-white/25 mt-0.5">
                            {w.walletAddress.slice(0,8)}…{w.walletAddress.slice(-6)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-white/70">{fmt(w.ordinaryIncomeUsd)}</td>
                        <td className="px-4 py-3.5 text-sm text-green-400/80">{fmt(w.realizedGainsUsd)}</td>
                        <td className="px-4 py-3.5 text-sm text-red-400/80">{fmt(w.realizedLossesUsd)}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold">
                          <span className={netGl >= 0 ? "text-green-400" : "text-red-400"}>
                            {fmt(netGl)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-white/40">{fmt(w.txFeesUsd)}</td>
                        <td className="px-4 py-3.5 text-sm text-white/40">{w.eventCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Export / CPA actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.open(`/api/orgs/${orgId}/tax/export?year=${year}`, "_blank")}
              className="text-xs bg-white/[0.06] text-white/60 px-4 py-2 rounded-lg
                hover:bg-white/[0.08] transition-colors border border-white/[0.06]"
            >
              Export CSV for CPA →
            </button>
            <button
              onClick={() => {
                // Trigger a CPA-format report
                fetch(`/api/orgs/${orgId}/reports`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    reportType: "TAX_POSITION",
                    reportFormat: "CPA",
                    periodStart: new Date(`${year}-01-01`).toISOString(),
                    periodEnd: new Date(`${year}-12-31T23:59:59Z`).toISOString(),
                  }),
                }).then(() => window.location.href = "/reports");
              }}
              className="text-xs bg-green-500/15 text-green-400 px-4 py-2 rounded-lg
                hover:bg-green-500/20 transition-colors border border-green-500/25"
            >
              Generate CPA PDF report →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
