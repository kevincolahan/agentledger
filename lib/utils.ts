import crypto from "crypto";

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatUsd(amount: number | string | null | undefined): string {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatSol(lamports: number): string {
  return (lamports / 1e9).toFixed(6) + " SOL";
}

export function truncatePubkey(pubkey: string, start = 8, end = 6): string {
  if (pubkey.length <= start + end) return pubkey;
  return `${pubkey.slice(0, start)}…${pubkey.slice(-end)}`;
}

export function truncateTx(sig: string): string {
  return truncatePubkey(sig, 12, 8);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Hashing ──────────────────────────────────────────────────────────────────

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacSha256(key: string, data: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Validates a Solana public key (base58, 32–44 chars) */
export function isValidSolanaPubkey(key: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key);
}

/** Validates a Solana transaction signature (base58, 87–88 chars) */
export function isValidSolanaSignature(sig: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(sig);
}

// ─── Plan limits ──────────────────────────────────────────────────────────────

export const PLAN_WALLET_LIMITS: Record<string, number> = {
  STARTER: 5,
  PROFESSIONAL: 25,
  ENTERPRISE: Infinity,
};

export const PLAN_RETENTION_DAYS: Record<string, number> = {
  STARTER: 90,
  PROFESSIONAL: 365,
  ENTERPRISE: Infinity,
};

export function planDisplayName(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

// ─── Solana explorer links ────────────────────────────────────────────────────

export function solscanTxUrl(sig: string): string {
  return `https://solscan.io/tx/${sig}`;
}

export function solscanAccountUrl(pubkey: string): string {
  return `https://solscan.io/account/${pubkey}`;
}

// ─── API key generation ───────────────────────────────────────────────────────

export function generateApiKey(): string {
  return "al_live_" + crypto.randomBytes(24).toString("base64url");
}

export function generateCronSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
