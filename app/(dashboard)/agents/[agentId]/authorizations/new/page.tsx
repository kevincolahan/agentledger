"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

const TX_TYPES = [
  { value: "swap", label: "Token swap" },
  { value: "stake", label: "Staking" },
  { value: "transfer", label: "Transfer" },
  { value: "unstake", label: "Unstaking" },
  { value: "nft_mint", label: "NFT mint" },
  { value: "liquidity_add", label: "Add liquidity" },
  { value: "liquidity_remove", label: "Remove liquidity" },
  { value: "x402_payment", label: "x402 API payment" },
  { value: "borrow", label: "Borrow / lending" },
];

const COMMON_PROGRAMS = [
  { value: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", label: "Jupiter (aggregator)" },
  { value: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD", label: "Marinade (staking)" },
  { value: "BluEFRoAvvhXDw4TfbRqzqyFIeJPuGVq5wTCDsv8tR5h", label: "Blueprint (staking)" },
  { value: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", label: "Orca (DEX)" },
  { value: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", label: "Raydium (DEX)" },
];

export default function NewAuthorizationPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(true);

  useEffect(() => {
    fetch("/api/authorization-templates")
      .then(r => r.json())
      .then(({ templates }) => setTemplates(templates));
  }, []);

  function applyTemplate(t: any) {
    setForm({
      maxTxValueUsd: t.maxTxValueUsd?.toString() ?? "",
      maxDailySpendUsd: t.maxDailySpendUsd?.toString() ?? "",
      whitelistedPrograms: t.whitelistedPrograms.map((p: any) => p.address),
      customProgram: "",
      permittedTxTypes: t.permittedTxTypes,
      operationalPurpose: t.operationalPurpose,
    });
    setShowTemplates(false);
  }

  const [form, setForm] = useState({
    maxTxValueUsd: "",
    maxDailySpendUsd: "",
    whitelistedPrograms: [] as string[],
    customProgram: "",
    permittedTxTypes: [] as string[],
    operationalPurpose: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleTxType(type: string) {
    setForm((f) => ({
      ...f,
      permittedTxTypes: f.permittedTxTypes.includes(type)
        ? f.permittedTxTypes.filter((t) => t !== type)
        : [...f.permittedTxTypes, type],
    }));
  }

  function toggleProgram(prog: string) {
    setForm((f) => ({
      ...f,
      whitelistedPrograms: f.whitelistedPrograms.includes(prog)
        ? f.whitelistedPrograms.filter((p) => p !== prog)
        : [...f.whitelistedPrograms, prog],
    }));
  }

  function addCustomProgram() {
    const val = form.customProgram.trim();
    if (!val || form.whitelistedPrograms.includes(val)) return;
    setForm((f) => ({
      ...f,
      whitelistedPrograms: [...f.whitelistedPrograms, val],
      customProgram: "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Get orgId from session
      const meRes = await fetch("/api/me");
      const { orgId } = await meRes.json();

      const res = await fetch(`/api/orgs/${orgId}/agents/${agentId}/authorizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxTxValueUsd: form.maxTxValueUsd ? Number(form.maxTxValueUsd) : undefined,
          maxDailySpendUsd: form.maxDailySpendUsd ? Number(form.maxDailySpendUsd) : undefined,
          whitelistedPrograms: form.whitelistedPrograms,
          permittedTxTypes: form.permittedTxTypes,
          operationalPurpose: form.operationalPurpose,
          orgSignerPubkey: "platform", // MVP: platform signs
          skipClientSignature: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.fieldErrors ? JSON.stringify(data.error.fieldErrors) : data.error);
        return;
      }

      router.push(`/agents/${agentId}?created=1`);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">New authorization record</h1>
        <p className="text-sm text-white/40 mt-1">
          Define the operational scope for this agent. The record will be cryptographically signed
          and anchored on Solana.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Operational purpose */}
        {/* Template picker */}
        {showTemplates && templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Start from a template <span className="text-white/30 font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {templates.slice(0, 6).map((t) => (
                <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                  className="text-left px-3 py-2.5 rounded-lg border bg-white/[0.02] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04] transition-all">
                  <div className="text-xs font-medium text-white/80">{t.name}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{t.description}</div>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowTemplates(false)}
              className="text-xs text-white/30 hover:text-white/50">
              Skip templates →
            </button>
            <div className="border-t border-white/[0.06] mt-4 mb-2" />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Operational purpose <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.operationalPurpose}
            onChange={(e) => setForm((f) => ({ ...f, operationalPurpose: e.target.value }))}
            rows={3}
            required
            minLength={10}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white
              placeholder-white/20 focus:outline-none focus:border-green-500/50 resize-none"
            placeholder="Describe what this agent is authorized to do and why. E.g. 'Yield optimization agent — authorized to swap USDC to SOL on Jupiter and stake via Blueprint validator to maximize staking yield. Maximum position size $500.'"
          />
        </div>

        {/* Spending limits */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">Spending limits</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Max per transaction (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maxTxValueUsd}
                  onChange={(e) => setForm((f) => ({ ...f, maxTxValueUsd: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-4 py-2.5 text-sm text-white
                    placeholder-white/20 focus:outline-none focus:border-green-500/50"
                  placeholder="500"
                />
              </div>
              <p className="text-[11px] text-white/20 mt-1">Leave empty for no limit</p>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Max daily spend (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maxDailySpendUsd}
                  onChange={(e) => setForm((f) => ({ ...f, maxDailySpendUsd: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-4 py-2.5 text-sm text-white
                    placeholder-white/20 focus:outline-none focus:border-green-500/50"
                  placeholder="2000"
                />
              </div>
              <p className="text-[11px] text-white/20 mt-1">Leave empty for no limit</p>
            </div>
          </div>
        </div>

        {/* Permitted transaction types */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">
            Permitted transaction types <span className="text-red-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TX_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => toggleTxType(type.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  form.permittedTxTypes.includes(type.value)
                    ? "bg-green-500/15 border-green-500/40 text-green-400"
                    : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          {form.permittedTxTypes.length === 0 && (
            <p className="text-[11px] text-amber-400/60 mt-2">Select at least one transaction type</p>
          )}
        </div>

        {/* Whitelisted programs */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">
            Whitelisted Solana programs
            <span className="text-white/30 font-normal ml-2">(optional — recommended)</span>
          </label>
          <div className="space-y-2 mb-3">
            {COMMON_PROGRAMS.map((prog) => (
              <button
                key={prog.value}
                type="button"
                onClick={() => toggleProgram(prog.value)}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                  form.whitelistedPrograms.includes(prog.value)
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-white/[0.02] border-white/[0.05] text-white/50 hover:border-white/10 hover:text-white/70"
                }`}
              >
                <span>{prog.label}</span>
                <code className="text-[10px] opacity-60">
                  {prog.value.slice(0, 8)}…
                </code>
              </button>
            ))}
          </div>

          {/* Custom program */}
          <div className="flex gap-2">
            <input
              type="text"
              value={form.customProgram}
              onChange={(e) => setForm((f) => ({ ...f, customProgram: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomProgram())}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white
                placeholder-white/20 focus:outline-none focus:border-green-500/50 font-mono"
              placeholder="Add program ID (pubkey)…"
            />
            <button
              type="button"
              onClick={addCustomProgram}
              className="text-xs bg-white/[0.06] text-white/60 px-3 py-2 rounded-lg hover:bg-white/[0.08] transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* On-chain anchoring notice */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-4 py-3">
          <div className="text-xs font-medium text-green-400 mb-1">⚓ On-chain anchoring</div>
          <div className="text-xs text-white/40 leading-relaxed">
            This authorization record will be cryptographically hashed and anchored to the Solana
            blockchain via a memo transaction. The on-chain signature provides tamper-proof evidence
            that this record existed as documented. Anchoring costs ~$0.00025 and completes within
            seconds.
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || form.permittedTxTypes.length === 0}
            className="bg-green-500 text-black font-semibold text-sm px-6 py-2.5 rounded-lg
              hover:bg-green-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Creating…" : "Create authorization record"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
