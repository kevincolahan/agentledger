import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What's new in AgentLedger — latest features and improvements.",
};

const CHANGELOG = [
  {
    date: "2026-04-05",
    version: "0.3.0",
    label: "MCP Server",
    badge: "new",
    items: [
      "@agentledger/mcp — MCP server for Claude Code and OpenClaw agents. 10 tools: get_authorization, log_reasoning, check_authorization, verify_anchor, generate_report, and more.",
      "Agents can now check their own authorization scope before acting — no SDK code required.",
      "ClawHub installable: npx skills add agentledger/mcp",
    ],
  },
  {
    date: "2026-04-01",
    version: "0.2.0",
    label: "Authorization templates",
    badge: "new",
    items: [
      "8 pre-built authorization templates: Yield Optimizer, x402 API Gateway, Portfolio Rebalancer, NFT Collection Manager, DAO Voting Delegate, Liquidity Provider, Treasury Manager, Read-Only Monitor.",
      "Templates pre-populate permitted transaction types, whitelisted programs, and operational purpose — first authorization record in under 2 minutes.",
      "Shareable audit report URLs — auditors can view reports in browser without downloading PDF.",
      "Public anchor verification page — anyone can verify any AgentLedger record on-chain.",
    ],
  },
  {
    date: "2026-03-25",
    version: "0.1.0",
    label: "Initial release",
    badge: "launch",
    items: [
      "Authorization registry — signed, on-chain-anchored scope documents per agent wallet.",
      "Decision audit trail — reasoning-to-transaction Merkle-anchored sessions via SDK.",
      "Policy engine — Claude-powered nightly compliance scanning (rule-based + reasoning consistency).",
      "Audit package export — PDF with STANDARD, FEDERAL (NIST/CMMC), and CPA formats.",
      "Tax module — per-wallet IRS 2026 cost basis, staking income, x402 API fee classification via Helius.",
      "@agentledger/sdk — drop-in for ElizaOS, Solana Agent Kit, GOAT, custom runtimes.",
      "Integration with Solana Agent Registry (ERC-8004).",
    ],
  },
];

const BADGE_STYLES: Record<string, string> = {
  new:    "bg-green-500/10 text-green-400 border-green-500/25",
  launch: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  fix:    "bg-amber-500/10 text-amber-400 border-amber-500/25",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Nav */}
      <nav className="relative px-8 py-5 flex items-center gap-4 border-b border-white/[0.04]">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center">
            <span className="text-black font-bold text-[9px]">AL</span>
          </div>
          <span className="font-semibold text-white text-sm">AgentLedger</span>
        </Link>
        <span className="text-white/20">·</span>
        <span className="text-sm text-white/50">Changelog</span>
      </nav>

      <div className="relative max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold text-white mb-2">Changelog</h1>
        <p className="text-sm text-white/40 mb-12">
          Product updates and new features.
        </p>

        <div className="space-y-12">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="relative">
              {/* Timeline line */}
              <div className="absolute left-0 top-6 bottom-0 w-px bg-white/[0.06]" />

              <div className="pl-8">
                {/* Dot */}
                <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-green-500 -translate-x-[3px]" />

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-white/30">{entry.date}</span>
                  <span className="text-xs font-mono text-white/20">v{entry.version}</span>
                  <span className={`text-[11px] border px-2 py-0.5 rounded-full font-medium ${BADGE_STYLES[entry.badge]}`}>
                    {entry.label}
                  </span>
                </div>

                {/* Items */}
                <ul className="space-y-2">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/60 leading-relaxed">
                      <span className="text-green-500/50 mt-1 flex-shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] text-center">
          <Link
            href="/login"
            className="text-sm bg-green-500 text-black font-semibold px-6 py-3 rounded-xl hover:bg-green-400 transition-colors inline-block"
          >
            Get started free →
          </Link>
        </div>
      </div>
    </div>
  );
}
