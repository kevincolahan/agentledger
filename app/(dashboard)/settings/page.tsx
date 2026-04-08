"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface ApiKeyRecord {
  id: string;
  name: string;
  lastUsed: string | null;
  createdAt: string;
}

interface OrgInfo {
  id: string;
  name: string;
  planTier: string;
  apiKey: string;
  members: { userId: string; role: string; user: { email: string } }[];
}

const PLAN_DETAILS = {
  STARTER:      { price: "$49/mo",   wallets: "5 wallets",         badge: "text-white/50 border-white/[0.15]" },
  PROFESSIONAL: { price: "$199/mo",  wallets: "25 wallets",        badge: "text-blue-400 border-blue-500/30"  },
  ENTERPRISE:   { price: "$999/mo",  wallets: "Unlimited wallets", badge: "text-green-400 border-green-500/30" },
};

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";

  const [org, setOrg]           = useState<OrgInfo | null>(null);
  const [keys, setKeys]         = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [rootCopied, setRootCopied] = useState(false);

  // New key creation state
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey]   = useState<{ name: string; rawKey: string } | null>(null);
  const [keyCopied, setKeyCopied]     = useState(false);

  // Upgrade state
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/me/org").then(r => r.json()),
      fetch("/api/me").then(r => r.json()).then(({ orgId }) =>
        fetch(`/api/orgs/${orgId}/apikeys`).then(r => r.json())
      ),
    ]).then(([orgData, keysData]) => {
      setOrg(orgData.org);
      setKeys(keysData.keys ?? []);
      setLoading(false);
    });
  }, []);

  function copyRoot() {
    if (!org) return;
    navigator.clipboard.writeText(org.apiKey);
    setRootCopied(true);
    setTimeout(() => setRootCopied(false), 2000);
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!org || !newKeyName.trim()) return;
    setCreatingKey(true);

    const res = await fetch(`/api/orgs/${org.id}/apikeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();

    if (res.ok) {
      setCreatedKey({ name: data.key.name, rawKey: data.key.rawKey });
      setKeys(prev => [{ id: data.key.id, name: data.key.name, lastUsed: null, createdAt: data.key.createdAt }, ...prev]);
      setNewKeyName("");
    }
    setCreatingKey(false);
  }

  async function handleRevokeKey(keyId: string) {
    if (!org) return;
    await fetch(`/api/orgs/${org.id}/apikeys`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }),
    });
    setKeys(prev => prev.filter(k => k.id !== keyId));
  }

  async function handleUpgrade() {
    if (!org) return;
    setUpgrading(true);
    const nextPlan = org.planTier === "STARTER" ? "PROFESSIONAL" : "ENTERPRISE";
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: nextPlan }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setUpgrading(false);
  }

  if (loading) return <div className="p-8"><div className="h-64 bg-white/[0.03] rounded-xl animate-pulse" /></div>;
  if (!org) return <div className="p-8 text-white/40">Could not load settings.</div>;

  const plan = PLAN_DETAILS[org.planTier as keyof typeof PLAN_DETAILS] ?? PLAN_DETAILS.STARTER;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/40 mt-1">Organization settings, API access, and billing.</p>
      </div>

      {upgraded && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-3.5 mb-6">
          <span className="text-green-400">✓</span>
          <span className="text-sm font-medium text-green-400">Plan upgraded successfully</span>
        </div>
      )}

      <div className="space-y-6">

        {/* Organization */}
        <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-sm font-medium text-white mb-5">Organization</h2>
          <div className="space-y-3">
            <Row label="Name" value={org.name} />
            <Row label="Org ID" value={org.id} mono small />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Plan</span>
              <div className="flex items-center gap-2.5">
                <span className={`text-[11px] border px-2 py-0.5 rounded-full ${plan.badge}`}>
                  {org.planTier.charAt(0) + org.planTier.slice(1).toLowerCase()}
                </span>
                <span className="text-xs text-white/30">{plan.price} · {plan.wallets}</span>
              </div>
            </div>
          </div>

          {org.planTier !== "ENTERPRISE" && (
            <div className="mt-5 pt-5 border-t border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white/70">
                  Upgrade to {org.planTier === "STARTER" ? "Professional" : "Enterprise"}
                </div>
                <div className="text-xs text-white/30 mt-0.5">
                  {org.planTier === "STARTER"
                    ? "25 wallets, real-time alerts, API access — $199/mo"
                    : "Unlimited wallets, federal format, white-label PDF — $999/mo"}
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-40"
              >
                {upgrading ? "Redirecting…" : "Upgrade →"}
              </button>
            </div>
          )}
        </section>

        {/* Root SDK key */}
        <section id="sdk" className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-sm font-medium text-white mb-1">Default SDK key</h2>
          <p className="text-xs text-white/30 mb-4 leading-relaxed">
            The organization's root key. Use this in your agent runtime as{" "}
            <code className="font-mono text-white/50 bg-white/[0.04] px-1 rounded">AGENTLEDGER_KEY</code>.
            Create named keys below for per-agent or per-environment access.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 font-mono text-xs text-white/40 truncate">
              {org.apiKey}
            </div>
            <button
              onClick={copyRoot}
              className="text-xs bg-white/[0.06] text-white/60 px-4 py-2.5 rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0 border border-white/[0.06]"
            >
              {rootCopied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </section>

        {/* Named API keys */}
        <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-medium text-white">Named API keys</h2>
              <p className="text-xs text-white/30 mt-0.5">
                Create per-agent or per-environment keys. Revoke individually without rotating the root key.
              </p>
            </div>
            <span className="text-xs text-white/25">{keys.length} / 10</span>
          </div>

          {/* Newly created key banner */}
          {createdKey && (
            <div className="bg-green-500/8 border border-green-500/25 rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-400">
                  ✓ Key created: {createdKey.name}
                </span>
                <button onClick={() => setCreatedKey(null)} className="text-white/30 hover:text-white/60 text-xs">
                  Dismiss
                </button>
              </div>
              <p className="text-[11px] text-amber-400/80 mb-3">
                Copy this key now — it will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-green-300 truncate">
                  {createdKey.rawKey}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdKey.rawKey);
                    setKeyCopied(true);
                    setTimeout(() => setKeyCopied(false), 2000);
                  }}
                  className="text-xs bg-green-500 text-black font-semibold px-3 py-2 rounded-lg hover:bg-green-400 transition-colors flex-shrink-0"
                >
                  {keyCopied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Existing keys list */}
          {keys.length > 0 && (
            <div className="mb-5 divide-y divide-white/[0.04] border border-white/[0.06] rounded-lg overflow-hidden">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between px-4 py-3 bg-white/[0.01] hover:bg-white/[0.02]">
                  <div>
                    <div className="text-sm text-white/80">{key.name}</div>
                    <div className="text-[11px] text-white/30 mt-0.5">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsed && ` · Last used ${new Date(key.lastUsed).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors border border-red-500/20 hover:border-red-500/40 px-3 py-1 rounded-lg"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create new key form */}
          {keys.length < 10 && (
            <form onSubmit={handleCreateKey} className="flex items-center gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. yield-optimizer-prod)"
                maxLength={60}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white
                  placeholder-white/20 focus:outline-none focus:border-green-500/50"
              />
              <button
                type="submit"
                disabled={creatingKey || !newKeyName.trim()}
                className="text-xs bg-white/[0.06] text-white/60 px-4 py-2.5 rounded-lg hover:bg-white/[0.08] transition-colors border border-white/[0.06] disabled:opacity-40 flex-shrink-0"
              >
                {creatingKey ? "Creating…" : "Create key"}
              </button>
            </form>
          )}
        </section>

        {/* Quick start */}
        <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-sm font-medium text-white mb-3">SDK quick start</h2>
          <pre className="bg-[#0d0d0d] border border-white/[0.06] rounded-lg p-4 text-xs text-green-400/80 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
{`npm install @agentledger/sdk

import { AgentLedger } from '@agentledger/sdk';

const ledger = new AgentLedger({
  apiKey: process.env.AGENTLEDGER_KEY,
  agentWalletAddress: process.env.WALLET_ADDRESS,
  framework: 'solana-agent-kit',
});

const result = await ledger.executeWithAudit(
  'Rebalancing yield — swapping USDC to SOL',
  () => agentKit.swap({ ... })
);

// On shutdown
process.on('SIGTERM', () => ledger.endSession());`}
          </pre>
          <p className="text-xs text-white/25 mt-3">
            Ingest endpoint: <code className="font-mono text-white/35">https://ingest.agentledger.io</code>
            <br />
            Install as an agent skill: <code className="font-mono text-white/35">npx skills add agentledger/audit-sdk</code>
          </p>
        </section>

        {/* Team */}
        <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-sm font-medium text-white mb-4">Team</h2>
          <div className="space-y-1">
            {org.members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                <span className="text-sm text-white/70">{m.user.email}</span>
                <span className="text-[11px] text-white/30 border border-white/[0.08] px-2 py-0.5 rounded-full">
                  {m.role.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/20 mt-3">
            To invite team members, contact{" "}
            <a href="mailto:support@agentledger.io" className="text-white/30 hover:text-white/50">
              support@agentledger.io
            </a>
          </p>
        </section>

      </div>
    </div>
  );
}

function Row({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/40">{label}</span>
      <span className={`${small ? "text-[11px]" : "text-sm"} ${mono ? "font-mono text-white/40" : "text-white/70"}`}>{value}</span>
    </div>
  );
}
