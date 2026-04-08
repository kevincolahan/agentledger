"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("resend", {
      email,
      redirect: false,
      callbackUrl: "/agents",
    });

    if (result?.error) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center">
            <span className="text-black font-bold text-[11px]">AL</span>
          </div>
          <span className="font-semibold text-white text-base">AgentLedger</span>
        </div>

        {!sent ? (
          <>
            <h1 className="text-2xl font-semibold text-white mb-2">Sign in</h1>
            <p className="text-sm text-white/40 mb-8">
              Enter your email to receive a magic link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@company.com"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3
                    text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50
                    transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-green-500 text-black font-semibold text-sm py-3 rounded-lg
                  hover:bg-green-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>

            <p className="mt-6 text-xs text-white/20 text-center leading-relaxed">
              By signing in you agree to our terms of service.
              <br />
              No password required — we&apos;ll email you a one-time link.
            </p>
          </>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30
              flex items-center justify-center mx-auto mb-5">
              <span className="text-green-400 text-xl">✓</span>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Check your email</h1>
            <p className="text-sm text-white/40 mb-6 leading-relaxed">
              We sent a sign-in link to<br />
              <span className="text-white/70">{email}</span>
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
