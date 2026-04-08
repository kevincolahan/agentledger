"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FRAMEWORKS = [
  { value: "SOLANA_AGENT_KIT", label: "Solana Agent Kit", desc: "SendAI SAK — most common" },
  { value: "ELIZAOS", label: "ElizaOS", desc: "Character-based agent framework" },
  { value: "GOAT", label: "GOAT", desc: "200+ onchain tools" },
  { value: "CUSTOM", label: "Custom", desc: "Homegrown or other framework" },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    agentName: "",
    agentDescription: "",
    walletAddress: "",
    walletChain: "SOLANA",
    framework: "CUSTOM",
    registryAgentId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletValidation, setWalletValidation] = useState<{ valid: boolean; reason?: string } | null>(null);

  // Debounced wallet validation
  useEffect(() => {
    if (!form.walletAddress || form.walletAddress.length < 32) { setWalletValidation(null); return; }
    const timer = setTimeout(async () => {
      const orgRes = await fetch("/api/me").then(r => r.json());
      const res = await fetch(`/api/validate-wallet?address=${form.walletAddress}&orgId=${orgRes.orgId}`);
      const data = await res.json();
      setWalletValidation(data);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.walletAddress]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const meRes = await fetch("/api/me");
      const { orgId } = await meRes.json();

      const res = await fetch(`/api/orgs/${orgId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: form.agentName,
          agentDescription: form.agentDescription || undefined,
          walletAddress: form.walletAddress,
          walletChain: form.walletChain,
          framework: form.framework,
          registryAgentId: form.registryAgentId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to register agent");
        return;
      }

      const { agent } = await res.json();
      // Go straight to the new authorization form
      router.push(`/agents/${agent.id}/authorizations/new`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-xs text-white/30 hover:text-white/60 mb-4 flex items-center gap-1.5 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold text-white">Register agent wallet</h1>
        <p className="text-sm text-white/40 mt-1">
          Step 1 of 2 — After registering, you&apos;ll create the first authorization record.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {["Register wallet", "Create authorization"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                i === 0
                  ? "bg-green-500 text-black"
                  : "bg-white/[0.06] text-white/30"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs ${
                i === 0 ? "text-white/70" : "text-white/25"
              }`}
            >
              {step}
            </span>
            {i < 1 && <span className="text-white/20 text-xs">→</span>}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agent name */}
        <div>
          <label className="block text-xs text-white/40 mb-1.5">
            Agent name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.agentName}
            onChange={(e) => setForm((f) => ({ ...f, agentName: e.target.value }))}
            required
            placeholder="e.g. Yield Optimizer, Treasury Manager, x402 API Agent"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3
              text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-white/40 mb-1.5">
            Description <span className="text-white/20">(optional)</span>
          </label>
          <input
            type="text"
            value={form.agentDescription}
            onChange={(e) => setForm((f) => ({ ...f, agentDescription: e.target.value }))}
            placeholder="Brief internal note about this agent's role"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3
              text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50"
          />
        </div>

        {/* Wallet address */}
        <div>
          <label className="block text-xs text-white/40 mb-1.5">
            Solana wallet address <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.walletAddress}
            onChange={(e) => setForm((f) => ({ ...f, walletAddress: e.target.value.trim() }))}
            required
            placeholder="e.g. 9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"
            className={`w-full bg-white/[0.04] border rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none font-mono transition-colors ${
              walletValidation === null ? "border-white/[0.08] focus:border-green-500/50"
              : walletValidation.valid ? "border-green-500/40"
              : "border-red-500/40"
            }`}
          />
          {walletValidation !== null && (
            <p className={`text-[11px] mt-1.5 ${walletValidation.valid ? "text-green-400/70" : "text-red-400"}`}>
              {walletValidation.valid ? "✓ Valid Solana address" : `✗ ${walletValidation.reason}`}
            </p>
          )}
          {walletValidation === null && form.walletAddress.length > 0 && (
            <p className="text-[11px] text-white/20 mt-1.5">Validating…</p>
          )}
          {!form.walletAddress && (
            <p className="text-[11px] text-white/20 mt-1.5">
              The public key of the wallet your agent uses to sign transactions.
            </p>
          )}
        </div>

        {/* Chain */}
        <div>
          <label className="block text-xs text-white/40 mb-2">Chain</label>
          <div className="flex gap-2">
            {["SOLANA", "BASE"].map((chain) => (
              <button
                key={chain}
                type="button"
                onClick={() => setForm((f) => ({ ...f, walletChain: chain }))}
                className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  form.walletChain === chain
                    ? "bg-green-500/15 border-green-500/40 text-green-400"
                    : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:border-white/10"
                }`}
              >
                {chain}
              </button>
            ))}
          </div>
        </div>

        {/* Framework */}
        <div>
          <label className="block text-xs text-white/40 mb-2">Agent framework</label>
          <div className="space-y-2">
            {FRAMEWORKS.map((fw) => (
              <button
                key={fw.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, framework: fw.value }))}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                  form.framework === fw.value
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-white/[0.02] border-white/[0.05] hover:border-white/10"
                }`}
              >
                <div>
                  <span
                    className={`text-sm font-medium ${
                      form.framework === fw.value ? "text-green-400" : "text-white/70"
                    }`}
                  >
                    {fw.label}
                  </span>
                  <span className="text-xs text-white/30 ml-2">{fw.desc}</span>
                </div>
                {form.framework === fw.value && (
                  <span className="text-green-400 text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Registry ID */}
        <div>
          <label className="block text-xs text-white/40 mb-1.5">
            Solana Agent Registry ID{" "}
            <span className="text-white/20">(optional)</span>
          </label>
          <input
            type="text"
            value={form.registryAgentId}
            onChange={(e) => setForm((f) => ({ ...f, registryAgentId: e.target.value }))}
            placeholder="ERC-8004 agent ID from registry.solana.com"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3
              text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 font-mono"
          />
          <p className="text-[11px] text-white/20 mt-1.5">
            Links this wallet to your on-chain agent identity. Enables cross-referencing in audit reports.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading || !form.agentName || !form.walletAddress}
            className="bg-green-500 text-black font-semibold text-sm px-6 py-2.5 rounded-lg
              hover:bg-green-400 transition-colors disabled:opacity-40"
          >
            {loading ? "Registering…" : "Register & continue →"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/agents")}
            className="text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
