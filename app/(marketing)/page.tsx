import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Grid background */}
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center">
            <span className="text-black font-bold text-[11px]">AL</span>
          </div>
          <span className="font-semibold text-white">AgentLedger</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#features" className="text-sm text-white/50 hover:text-white/80 transition-colors">Features</Link>
          <Link href="#pricing" className="text-sm text-white/50 hover:text-white/80 transition-colors">Pricing</Link>
          <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition-colors">Sign in</Link>
          <Link
            href="/login"
            className="text-sm bg-green-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-green-400 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center pt-20 pb-24 px-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/25 px-3 py-1.5 rounded-full text-xs text-green-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Built for Solana's agentic economy
        </div>

        <h1 className="text-5xl font-semibold leading-[1.15] mb-6 tracking-tight">
          The compliance layer for<br />
          <span className="text-green-400">autonomous Solana agents</span>
        </h1>

        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Authorization records, decision audit trails, and tax reporting for enterprises
          operating AI agent fleets on Solana. Produce audit packages that pass CFO,
          legal, and CMMC review — not just a dashboard.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="bg-green-500 text-black font-semibold px-7 py-3.5 rounded-xl hover:bg-green-400 transition-colors text-sm"
          >
            Start free trial
          </Link>
          <a
            href="https://github.com/agentledger"
            className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-2 border border-white/[0.08] px-6 py-3.5 rounded-xl hover:border-white/20"
          >
            View on GitHub →
          </a>
        </div>

        <p className="text-xs text-white/25 mt-5">
          No credit card required · Free tier includes 5 agent wallets
        </p>
      </section>

      {/* Differentiators */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-3 gap-5 mb-5">
          {[
            {
              icon: "⚓",
              title: "On-chain anchored",
              body: "Every authorization record and audit session Merkle root is anchored to Solana via memo transactions. Auditors can independently verify record integrity without trusting AgentLedger.",
            },
            {
              icon: "📋",
              title: "The audit package CFOs recognize",
              body: "Single-click PDF export with cover page, authorization records, policy findings, and an attestation signature block. Federal format uses NIST SP 800-53 / CMMC language.",
            },
            {
              icon: "💰",
              title: "IRS 2026-ready tax reporting",
              body: "Per-wallet cost basis tracking as required by IRS rules effective January 1, 2026. Classifies staking income, x402 API fees, swap gains/losses, and transfers. CPA-ready export.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <div className="text-2xl mb-4 opacity-60">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {[
            {
              icon: "🔍",
              title: "Claude-powered policy engine",
              body: "Nightly compliance scans compare agent transaction history against authorization records. Rule-based checks catch limit violations instantly. Claude handles reasoning-consistency analysis where judgment is needed.",
            },
            {
              icon: "📦",
              title: "6-line SDK integration",
              body: "Drop @agentledger/sdk into any Solana Agent Kit, ElizaOS, or GOAT runtime. Captures reasoning summaries, prompt context hashes, tool calls, and on-chain signatures without sending raw prompts or keys.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <div className="text-2xl mb-4 opacity-60">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section id="features" className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-semibold text-white mb-2 text-center">Built for three buyers</h2>
        <p className="text-sm text-white/40 text-center mb-10">
          Analytix402 tells you what your agents spent. AgentLedger proves they had authorization.
        </p>
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              role: "Enterprise AI Ops",
              badge: "bg-blue-500/10 text-blue-400 border-blue-500/25",
              points: ["Board-level governance documentation", "Authorization scope versioning", "Policy deviation findings + remediation workflow", "Downloadable audit packages for internal review"],
            },
            {
              role: "Federal Contractors",
              badge: "bg-amber-500/10 text-amber-400 border-amber-500/25",
              points: ["CMMC Level 2/3 assessment ready", "NIST SP 800-53 AC-2 formatted output", "POA&M-style findings workflow", "Audit packages formatted for DCSA / CMMC C3PAOs"],
            },
            {
              role: "Crypto-native Businesses",
              badge: "bg-green-500/10 text-green-400 border-green-500/25",
              points: ["Per-wallet IRS cost basis (2026 rules)", "Staking income + x402 API fee classification", "CPA-ready PDF export", "Helius-powered complete tx history"],
            },
          ].map((p) => (
            <div key={p.role} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <span className={`text-[11px] border px-2.5 py-1 rounded-full font-medium ${p.badge}`}>
                {p.role}
              </span>
              <ul className="mt-5 space-y-2.5">
                {p.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-xs text-white/50 leading-relaxed">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-semibold text-white mb-2 text-center">Pricing</h2>
        <p className="text-sm text-white/40 text-center mb-10">
          Start free. Upgrade when your agent fleet grows.
        </p>
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              name: "Starter",
              price: "$49",
              period: "/mo",
              wallets: "5 agent wallets",
              features: ["Authorization registry", "Audit package export", "90-day log retention", "Standard PDF format", "Monthly tax reports"],
              cta: "Start free",
              highlight: false,
            },
            {
              name: "Professional",
              price: "$199",
              period: "/mo",
              wallets: "25 agent wallets",
              features: ["Everything in Starter", "1-year log retention", "Real-time policy alerts", "API access", "Quarterly tax reports", "All PDF formats"],
              cta: "Start free",
              highlight: true,
            },
            {
              name: "Enterprise",
              price: "$999",
              period: "/mo",
              wallets: "Unlimited wallets",
              features: ["Everything in Professional", "Unlimited retention", "Federal / CMMC format", "NIST SP 800-53 language", "White-label PDF export", "Dedicated support"],
              cta: "Contact us",
              highlight: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border ${
                plan.highlight
                  ? "bg-green-500/[0.06] border-green-500/30"
                  : "bg-white/[0.02] border-white/[0.06]"
              }`}
            >
              {plan.highlight && (
                <div className="text-[10px] font-semibold text-green-400 bg-green-500/15 border border-green-500/25 px-2.5 py-1 rounded-full inline-block mb-3">
                  Most popular
                </div>
              )}
              <div className="mb-1 text-white font-semibold">{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-semibold text-white">{plan.price}</span>
                <span className="text-sm text-white/40">{plan.period}</span>
              </div>
              <div className="text-xs text-white/30 mb-5">{plan.wallets}</div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                    <span className="text-green-400 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.cta === "Contact us" ? "mailto:support@agentledger.io" : "/login"}
                className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                  plan.highlight
                    ? "bg-green-500 text-black hover:bg-green-400"
                    : "bg-white/[0.06] text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 pb-32 text-center">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Your agents are transacting 24/7.<br />
          Can you prove they had authorization?
        </h2>
        <p className="text-sm text-white/40 mb-8">
          Every enterprise deploying autonomous agents will eventually face this question from an auditor, a CFO, or a regulator.
          AgentLedger is the answer.
        </p>
        <Link
          href="/login"
          className="bg-green-500 text-black font-semibold px-8 py-3.5 rounded-xl hover:bg-green-400 transition-colors text-sm inline-block"
        >
          Start free — no credit card required
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] px-8 py-6 max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center">
            <span className="text-black font-bold text-[8px]">AL</span>
          </div>
          <span className="text-xs text-white/30">AgentLedger © 2026</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="mailto:support@agentledger.io" className="text-xs text-white/30 hover:text-white/60 transition-colors">support@agentledger.io</a>
          <Link href="/login" className="text-xs text-white/30 hover:text-white/60 transition-colors">Sign in</Link>
          <Link href="/verify" className="text-xs text-white/30 hover:text-white/60 transition-colors">Verify anchor</Link>
          <Link href="/changelog" className="text-xs text-white/30 hover:text-white/60 transition-colors">Changelog</Link>
        </div>
      </footer>
    </div>
  );
}
