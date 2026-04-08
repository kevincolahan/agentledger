/**
 * AgentLedger — Environment Validation
 *
 * Validates required env vars at startup.
 * Run via: import "@/lib/env" at the top of lib/prisma.ts
 *
 * Tiers:
 *   REQUIRED  — app will not function without these
 *   CORE      — major features disabled without these
 *   OPTIONAL  — specific features disabled
 */

const vars = {
  required: [
    { key: "DATABASE_URL",   hint: "PostgreSQL connection string from Railway"             },
    { key: "AUTH_SECRET",    hint: "Run: openssl rand -base64 32"                          },
    { key: "RESEND_API_KEY", hint: "From resend.com — required for magic link auth"        },
  ],
  core: [
    { key: "ANTHROPIC_API_KEY",  hint: "From console.anthropic.com — powers policy engine + content" },
    { key: "HELIUS_API_KEY",     hint: "From helius.xyz — required for tax module"                   },
    { key: "CRON_SECRET",        hint: "Run: openssl rand -hex 32"                                   },
  ],
  optional: [
    { key: "SOLANA_ANCHOR_PRIVATE_KEY", hint: "Solana keypair byte array — enables on-chain anchoring"   },
    { key: "SOLANA_RPC_URL",            hint: "Defaults to mainnet-beta if not set"                      },
    { key: "R2_ACCOUNT_ID",             hint: "Cloudflare R2 — required for PDF report storage"          },
    { key: "R2_ACCESS_KEY_ID",          hint: "Cloudflare R2 API token"                                  },
    { key: "R2_SECRET_ACCESS_KEY",      hint: "Cloudflare R2 API secret"                                 },
    { key: "STRIPE_SECRET_KEY",         hint: "From Stripe dashboard — required for billing"             },
    { key: "STRIPE_WEBHOOK_SECRET",     hint: "From Stripe webhook settings"                             },
    { key: "ADMIN_EMAILS",              hint: "Your email — gates /admin access"                         },
    { key: "HASHNODE_API_KEY",          hint: "From hashnode.com — enables blog auto-publish"            },
    { key: "TWITTER_BEARER_TOKEN",      hint: "From developer.twitter.com — enables X monitoring"       },
  ],
};

export function validateEnv(): { ok: boolean; missing: string[]; warnings: string[] } {
  const missing:  string[] = [];
  const warnings: string[] = [];

  for (const { key } of vars.required) {
    if (!process.env[key]) missing.push(key);
  }

  for (const { key, hint } of vars.core) {
    if (!process.env[key]) {
      warnings.push(`${key} not set — ${hint}`);
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}

// Called once at module load in development
if (process.env.NODE_ENV === "development") {
  const { ok, missing, warnings } = validateEnv();

  if (!ok) {
    console.error("\n\x1b[31m✗ AgentLedger: Missing required environment variables:\x1b[0m");
    for (const key of missing) {
      const v = vars.required.find((v) => v.key === key);
      console.error(`  ${key}: ${v?.hint ?? ""}`);
    }
    console.error("\nSee .env.example for reference.\n");
    // Don't exit — let Prisma give a more specific error
  }

  if (warnings.length > 0) {
    console.warn("\n\x1b[33m⚠ AgentLedger: Some features are disabled (env vars not set):\x1b[0m");
    for (const w of warnings.slice(0, 5)) {
      console.warn(`  ${w}`);
    }
    if (warnings.length > 5) console.warn(`  … and ${warnings.length - 5} more`);
    console.warn("");
  }
}
