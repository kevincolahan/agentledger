"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-detect: if org already exists, skip onboarding
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ orgId }) => {
        if (orgId) router.replace("/agents");
      });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create organization");
        return;
      }

      router.replace("/agents");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center">
            <span className="text-black font-bold text-[11px]">AL</span>
          </div>
          <span className="font-semibold text-white text-base">AgentLedger</span>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">Set up your organization</h1>
        <p className="text-sm text-white/40 mb-8">
          One last step. Give your organization a name to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Organization name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Acme AI Labs, GreyLee Services"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3
                text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !orgName.trim()}
            className="w-full bg-green-500 text-black font-semibold text-sm py-3 rounded-lg
              hover:bg-green-400 transition-colors disabled:opacity-40"
          >
            {loading ? "Creating…" : "Get started →"}
          </button>
        </form>
      </div>
    </div>
  );
}
