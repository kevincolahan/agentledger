'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/* ─── Animated mesh background ─────────────────────────────── */

function MeshBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    const NODE_COUNT = 40;
    const CONNECT_DIST = 160;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas!.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas!.height) node.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.35;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.strokeStyle = `rgba(153,69,255,${alpha})`;
            ctx!.lineWidth = 0.8;
            ctx!.stroke();
          }
        }
      }

      for (const node of nodes) {
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx!.fillStyle = 'rgba(153,69,255,0.2)';
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

/* ─── Anchor ticker ────────────────────────────────────────── */

const TICKER_MEMOS = [
  'AL:AUTH:v1:org_9x2k:agent_7f3m:sha256:a4f2c891...',
  'AL:AUDIT:v1:org_3d8f:session_2a1b:merkle:7e91cd02...',
  'AL:SCOPE:v1:org_5k2j:agent_9c4e:limit:500_SOL...',
  'AL:POLICY:v1:org_1m8n:scan_4f7g:findings:0...',
  'AL:TAX:v1:org_7r3s:wallet_6h2t:basis:FIFO_2026...',
  'AL:AUTH:v1:org_4w9x:agent_1b5y:sha256:c83fd712...',
];

function AnchorTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TICKER_MEMOS.length);
        setVisible(true);
      }, 400);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-10 border-b border-white/[0.04] bg-[#080611]/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-8 py-2 flex items-center gap-3">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-400" />
        </span>
        <span
          className="font-mono text-[11px] text-white/30 transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {TICKER_MEMOS[idx]}
        </span>
      </div>
    </div>
  );
}

/* ─── Solana gradient helper ───────────────────────────────── */

const SOL_GRADIENT = 'linear-gradient(135deg, #9945FF, #14F195)';

/* ─── Data ─────────────────────────────────────────────────── */

const FEATURES_ROW1 = [
  {
    icon: '\u2693',
    title: 'On-chain anchored',
    body: 'Every authorization record and audit session Merkle root is anchored to Solana via memo transactions. Auditors can independently verify record integrity without trusting AgentLedger.',
  },
  {
    icon: '\uD83D\uDCCB',
    title: 'The audit package CFOs recognize',
    body: 'Single-click PDF export with cover page, authorization records, policy findings, and an attestation signature block. Federal format uses NIST SP 800-53 / CMMC language.',
  },
  {
    icon: '\uD83D\uDCB0',
    title: 'IRS 2026-ready tax reporting',
    body: 'Per-wallet cost basis tracking as required by IRS rules effective January 1, 2026. Classifies staking income, x402 API fees, swap gains/losses, and transfers. CPA-ready export.',
  },
];

const FEATURES_ROW2 = [
  {
    icon: '\uD83D\uDD0D',
    title: 'Claude-powered policy engine',
    body: 'Nightly compliance scans compare agent transaction history against authorization records. Rule-based checks catch limit violations instantly. Claude handles reasoning-consistency analysis where judgment is needed.',
  },
  {
    icon: '\uD83D\uDCE6',
    title: '6-line SDK integration',
    body: 'Drop @agentledger/sdk into any Solana Agent Kit, ElizaOS, or GOAT runtime. Captures reasoning summaries, prompt context hashes, tool calls, and on-chain signatures without sending raw prompts or keys.',
  },
];

const BUYERS = [
  {
    role: 'Enterprise AI Ops',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
    points: [
      'Board-level governance documentation',
      'Authorization scope versioning',
      'Policy deviation findings + remediation workflow',
      'Downloadable audit packages for internal review',
    ],
  },
  {
    role: 'Federal Contractors',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    featured: true,
    points: [
      'CMMC Level 2/3 assessment ready',
      'NIST SP 800-53 AC-2 formatted output',
      'POA&M-style findings workflow',
      'Audit packages formatted for DCSA / CMMC C3PAOs',
    ],
  },
  {
    role: 'Crypto-native Businesses',
    badge: 'bg-green-500/10 text-green-400 border-green-500/25',
    points: [
      'Per-wallet IRS cost basis (2026 rules)',
      'Staking income + x402 API fee classification',
      'CPA-ready PDF export',
      'Helius-powered complete tx history',
    ],
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: '$49',
    period: '/mo',
    wallets: '5 agent wallets',
    features: [
      'Authorization registry',
      'Audit package export',
      '90-day log retention',
      'Standard PDF format',
      'Monthly tax reports',
    ],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '$199',
    period: '/mo',
    wallets: '25 agent wallets',
    features: [
      'Everything in Starter',
      '1-year log retention',
      'Real-time policy alerts',
      'API access',
      'Quarterly tax reports',
      'All PDF formats',
    ],
    cta: 'Start free',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$999',
    period: '/mo',
    wallets: 'Unlimited wallets',
    features: [
      'Everything in Professional',
      'Unlimited retention',
      'Federal / CMMC format',
      'NIST SP 800-53 language',
      'White-label PDF export',
      'Dedicated support',
    ],
    cta: 'Contact us',
    highlight: false,
  },
];

/* ─── Page ─────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#080611' }}>
      <MeshBackground />

      {/* Radial glow */}
      <div
        className="fixed top-0 inset-x-0 h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(153,69,255,0.12), transparent 60%)',
          zIndex: 1,
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: SOL_GRADIENT }}
          >
            <span className="text-black font-bold text-[11px]">AL</span>
          </div>
          <span className="font-semibold text-white">AgentLedger</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#features" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Features
          </Link>
          <Link href="#pricing" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm text-black font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
            style={{ background: SOL_GRADIENT }}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Anchor ticker */}
      <AnchorTicker />

      {/* Hero — split layout */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 pt-20 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 border border-purple-500/25 bg-purple-500/10 px-3 py-1.5 rounded-full text-xs mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span style={{ background: SOL_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Built for Solana&apos;s agentic economy
              </span>
            </div>

            <h1 className="text-5xl font-semibold leading-[1.15] mb-6 tracking-tight">
              The compliance layer for{' '}
              <span style={{ background: SOL_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                autonomous Solana agents
              </span>
            </h1>

            <p className="text-lg text-white/50 max-w-xl mb-10 leading-relaxed">
              Authorization records, decision audit trails, and tax reporting for enterprises
              operating AI agent fleets on Solana. Produce audit packages that pass CFO,
              legal, and CMMC review — not just a dashboard.
            </p>

            <div className="flex items-center gap-4 mb-5">
              <Link
                href="/login"
                className="text-black font-semibold px-7 py-3.5 rounded-xl transition-opacity hover:opacity-90 text-sm"
                style={{ background: SOL_GRADIENT }}
              >
                Start free trial
              </Link>
              <a
                href="https://github.com/agentledger"
                className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-2 border border-white/[0.08] px-6 py-3.5 rounded-xl hover:border-white/20"
              >
                View on GitHub &rarr;
              </a>
            </div>

            <p className="text-xs text-white/25">
              No credit card required &middot; Free tier includes 5 agent wallets
            </p>

            {/* Stats */}
            <div className="flex items-center gap-8 mt-10 pt-8 border-t border-white/[0.06]">
              {[
                { value: 'Solana', label: 'Native chain' },
                { value: '< 6 lines', label: 'SDK integration' },
                { value: 'NIST 800-53', label: 'Compliance format' },
              ].map((s) => (
                <div key={s.label}>
                  <div
                    className="text-lg font-semibold"
                    style={{ background: SOL_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  >
                    {s.value}
                  </div>
                  <div className="text-xs text-white/30">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — mock audit package card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1 backdrop-blur-sm">
            <div className="rounded-xl bg-[#0c0a18] p-6 font-mono text-xs">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="ml-2 text-white/20">audit-package.json</span>
              </div>

              <div className="space-y-2.5 text-white/50">
                <div>
                  <span className="text-purple-400">ORG</span>
                  <span className="text-white/20 mx-2">:</span>
                  <span className="text-white/70">Acme AI Corp</span>
                </div>
                <div>
                  <span className="text-purple-400">PERIOD</span>
                  <span className="text-white/20 mx-2">:</span>
                  <span className="text-white/70">2026-Q1</span>
                </div>
                <div>
                  <span className="text-purple-400">AGENTS</span>
                  <span className="text-white/20 mx-2">:</span>
                  <span className="text-white/70">12 active wallets</span>
                </div>
                <div>
                  <span className="text-purple-400">FRAMEWORK</span>
                  <span className="text-white/20 mx-2">:</span>
                  <span className="text-white/70">NIST SP 800-53 AC-2</span>
                </div>
                <div className="pt-3 border-t border-white/[0.06]">
                  <span className="text-purple-400">FINDINGS</span>
                  <span className="text-white/20 mx-2">:</span>
                  <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 border border-green-500/25 px-2 py-0.5 rounded text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    0 open findings
                  </span>
                </div>
                <div className="pt-3 border-t border-white/[0.06]">
                  <span className="text-purple-400">ANCHOR TX</span>
                  <span className="text-white/20 mx-2">:</span>
                  <span className="text-white/40">4sGjMW1s...Bz7kZr2c</span>
                </div>
                <div>
                  <span className="text-purple-400">MERKLE ROOT</span>
                  <span className="text-white/20 mx-2">:</span>
                  <span className="text-white/40">a4f2c891e7...3d8f1b</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-white/20">Ready to export</span>
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded"
                  style={{ background: SOL_GRADIENT, color: '#000' }}
                >
                  VERIFIED ON SOLANA
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiators — 6 feature cards */}
      <section id="features" className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          {FEATURES_ROW1.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl p-6 border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_24px_-6px_rgba(153,69,255,0.15)]"
            >
              <div className="text-2xl mb-4 opacity-60">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES_ROW2.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl p-6 border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_24px_-6px_rgba(153,69,255,0.15)]"
            >
              <div className="text-2xl mb-4 opacity-60">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{f.body}</p>
            </div>
          ))}

          {/* 6th card — new */}
          <div className="group rounded-2xl p-6 border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_24px_-6px_rgba(153,69,255,0.15)]">
            <div className="text-2xl mb-4 opacity-60">{'\uD83D\uDEE1\uFE0F'}</div>
            <h3 className="text-sm font-semibold text-white mb-2">Zero-knowledge proof pipeline</h3>
            <p className="text-xs text-white/45 leading-relaxed">
              Authorization hashes anchored on-chain without exposing prompt content, API keys, or business logic. Your compliance record is public. Your operations stay private.
            </p>
          </div>
        </div>
      </section>

      {/* Who it&apos;s for — three buyers */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-semibold text-white mb-2 text-center">Built for three buyers</h2>
        <p className="text-sm text-white/40 text-center mb-10">
          Analytix402 tells you what your agents spent. AgentLedger proves they had authorization.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {BUYERS.map((p) => (
            <div
              key={p.role}
              className={`rounded-2xl p-6 border transition-all duration-300 ${
                p.featured
                  ? 'border-purple-500/30 bg-purple-500/[0.04] shadow-[0_0_32px_-8px_rgba(153,69,255,0.12)]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              {p.featured && (
                <div
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full inline-block mb-3"
                  style={{ background: SOL_GRADIENT, color: '#000' }}
                >
                  Featured
                </div>
              )}
              {!p.featured && (
                <span className={`text-[11px] border px-2.5 py-1 rounded-full font-medium ${p.badge}`}>
                  {p.role}
                </span>
              )}
              {p.featured && (
                <span className={`text-[11px] border px-2.5 py-1 rounded-full font-medium ${p.badge} ml-2`}>
                  {p.role}
                </span>
              )}
              <ul className="mt-5 space-y-2.5">
                {p.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-xs text-white/50 leading-relaxed">
                    <span
                      className="mt-0.5 flex-shrink-0"
                      style={{ background: SOL_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      &#10003;
                    </span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border transition-all duration-300 ${
                plan.highlight
                  ? 'border-purple-500/30 bg-purple-500/[0.04] shadow-[0_0_32px_-8px_rgba(153,69,255,0.12)]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              {plan.highlight && (
                <div
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full inline-block mb-3"
                  style={{ background: SOL_GRADIENT, color: '#000' }}
                >
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
                    <span
                      className="flex-shrink-0"
                      style={{ background: SOL_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      &#10003;
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.cta === 'Contact us' ? 'mailto:support@agentledger.io' : '/login'}
                className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-opacity ${
                  plan.highlight ? 'text-black hover:opacity-90' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.08]'
                }`}
                style={plan.highlight ? { background: SOL_GRADIENT } : undefined}
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
          Your agents are transacting 24/7.
          <br />
          Can you prove they had authorization?
        </h2>
        <p className="text-sm text-white/40 mb-8">
          Every enterprise deploying autonomous agents will eventually face this question from an auditor, a CFO, or a regulator.
          AgentLedger is the answer.
        </p>
        <Link
          href="/login"
          className="text-black font-semibold px-8 py-3.5 rounded-xl transition-opacity hover:opacity-90 text-sm inline-block"
          style={{ background: SOL_GRADIENT }}
        >
          Start free — no credit card required
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.05] px-8 py-6 max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: SOL_GRADIENT }}
          >
            <span className="text-black font-bold text-[8px]">AL</span>
          </div>
          <span className="text-xs text-white/30">AgentLedger &copy; 2026</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="mailto:support@agentledger.io" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            support@agentledger.io
          </a>
          <Link href="/login" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Sign in
          </Link>
          <Link href="/verify" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Verify anchor
          </Link>
          <Link href="/changelog" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Changelog
          </Link>
        </div>
      </footer>
    </div>
  );
}
