"use client";

import { useState } from "react";
import Link from "next/link";

interface VerifyResult {
  valid: boolean;
  reason?: string;
  txSignature?: string;
  slot?: number;
  blockTime?: number;
  memo?: string;
  memoType?: string;
  contentHash?: string;
  database?: {
    found: boolean;
    id?: string;
    type?: string;
    createdAt?: string;
    hashMatch?: boolean;
    tampered?: boolean;
    reason?: string;
  };
}

export default function VerifyAnchorPage() {
  const [tx, setTx]           = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<VerifyResult | null>(null);
  const [error, setError]     = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!tx.trim()) return;
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res  = await fetch(`/api/verify-anchor?tx=${encodeURIComponent(tx.trim())}`);
      const data = await res.json() as VerifyResult;
      setResult(data);
    } catch {
      setError("Verification failed — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const isTampered = result?.database?.tampered;
  const isVerified = result?.valid && result.database?.found && result.database?.hashMatch;

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-10">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center">
              <span className="text-black font-bold text-[9px]">AL</span>
            </div>
            <span className="font-semibold text-white text-sm">AgentLedger</span>
          </Link>
          <span className="text-white/20">·</span>
          <span className="text-sm text-white/40">Anchor Verifier</span>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">Verify on-chain anchor</h1>
        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          Enter any AgentLedger anchor transaction signature to independently verify that an
          authorization record or audit session hash is authentic and unmodified.
        </p>

        <form onSubmit={handleVerify} className="space-y-4 mb-8">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Solana transaction signature</label>
            <input
              type="text"
              value={tx}
              onChange={(e) => setTx(e.target.value)}
              placeholder="e.g. 5Tz3UePCQPJAqNqyXdBwg3Hk2rz2…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3
                text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !tx.trim()}
            className="bg-green-500 text-black font-semibold text-sm px-6 py-2.5 rounded-lg
              hover:bg-green-400 transition-colors disabled:opacity-40"
          >
            {loading ? "Verifying…" : "Verify anchor"}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className={`rounded-xl border p-6 ${
            isTampered
              ? "bg-red-500/5 border-red-500/25"
              : isVerified
              ? "bg-green-500/5 border-green-500/25"
              : result.valid
              ? "bg-amber-500/5 border-amber-500/25"
              : "bg-red-500/5 border-red-500/20"
          }`}>
            {/* Status header */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                isTampered    ? "bg-red-500/20 text-red-400"
                : isVerified  ? "bg-green-500/20 text-green-400"
                : result.valid ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
              }`}>
                {isTampered ? "✗" : isVerified ? "✓" : result.valid ? "⚠" : "✗"}
              </div>
              <div>
                <div className={`font-semibold text-sm ${
                  isTampered    ? "text-red-400"
                  : isVerified  ? "text-green-400"
                  : result.valid ? "text-amber-400"
                  : "text-red-400"
                }`}>
                  {isTampered    ? "TAMPERED — hash mismatch detected"
                   : isVerified  ? "VERIFIED — authentic and unmodified"
                   : result.valid ? "Transaction valid — record not in database"
                   : result.reason ?? "Verification failed"}
                </div>
                {onChain(result) && (
                  <div className="text-xs text-white/30 mt-0.5">
                    Slot {result.slot?.toLocaleString()} ·{" "}
                    {result.blockTime && new Date(result.blockTime * 1000).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            {result.valid && (
              <div className="space-y-3 text-xs">
                <Field label="Transaction" value={result.txSignature ?? ""} mono link={`https://solscan.io/tx/${result.txSignature}`} />
                {result.memoType && <Field label="Record type" value={result.memoType} />}
                {result.contentHash && <Field label="Content hash" value={result.contentHash} mono />}

                {result.database?.found ? (
                  <>
                    <Field label="Database record" value={result.database.id ?? ""} mono />
                    <Field label="Record created" value={result.database.createdAt ? new Date(result.database.createdAt).toLocaleString() : ""} />
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        result.database.hashMatch
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }`}>
                        Hash {result.database.hashMatch ? "matches ✓" : "does NOT match ✗"}
                      </span>
                      <span className="text-white/30 text-[11px]">
                        {result.database.hashMatch
                          ? "The content of this record has not been modified since anchoring."
                          : "The stored record has been modified after anchoring."}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-white/40 mt-3 pt-3 border-t border-white/[0.06] text-[11px]">
                    {result.database?.reason ?? "Record not found in database."}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="mt-10 bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-sm font-medium text-white mb-3">How anchor verification works</h2>
          <div className="space-y-3 text-xs text-white/40 leading-relaxed">
            <p>
              When AgentLedger creates an authorization record or closes an audit session, it writes a
              SHA-256 hash of the record to the Solana blockchain via the Memo Program. This creates
              a permanent, timestamped, tamper-proof receipt.
            </p>
            <p>
              To verify: paste the Solana transaction signature above. This tool retrieves the memo from
              the chain, extracts the hash, and compares it against the current state of the record in the
              database. A match means the record has not been modified since it was anchored.
            </p>
            <p>
              Any auditor can independently verify records — no AgentLedger account required. You only
              need the transaction signature, which appears in any Solana explorer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function onChain(r: VerifyResult) { return r.valid && r.txSignature; }

function Field({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-white/30 min-w-[100px] flex-shrink-0">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="font-mono text-blue-400/70 hover:text-blue-400 break-all transition-colors">
          {value} ↗
        </a>
      ) : (
        <span className={`${mono ? "font-mono text-white/40" : "text-white/60"} break-all`}>{value}</span>
      )}
    </div>
  );
}
