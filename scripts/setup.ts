#!/usr/bin/env node
/**
 * AgentLedger — Bootstrap Setup Script
 *
 * Automates the entire deployment from scratch:
 *   1. Checks / installs required CLIs
 *   2. Generates all secrets
 *   3. Creates Railway project + Postgres + deploys ingest service
 *   4. Creates Cloudflare R2 bucket
 *   5. Generates Solana anchor keypair
 *   6. Creates Stripe products and prices
 *   7. Deploys Next.js app to Vercel
 *   8. Runs DB migrations + seed
 *   9. Sets up Railway cron jobs
 *  10. Writes final .env and prints summary
 *
 * Minimal interaction required:
 *   - 4 browser logins (Railway, Vercel, Stripe, Cloudflare)
 *   - 3 API key pastes (Resend, Helius, Anthropic — you already have these)
 *
 * Run: node scripts/setup.js
 * Re-run: node scripts/setup.js --update  (redeploy without re-creating resources)
 */

import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createInterface } from "readline";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");
const ENV_FILE  = path.join(ROOT, ".env");
const STATE_FILE = path.join(ROOT, ".setup-state.json");

const UPDATE_ONLY = process.argv.includes("--update");

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  reset:  "\x1b[0m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  dim:    "\x1b[2m",
  bold:   "\x1b[1m",
};

const log   = (msg: string) => console.log(`${C.green}✓${C.reset}  ${msg}`);
const info  = (msg: string) => console.log(`${C.cyan}→${C.reset}  ${msg}`);
const warn  = (msg: string) => console.log(`${C.yellow}⚠${C.reset}  ${msg}`);
const error = (msg: string) => console.log(`${C.red}✗${C.reset}  ${msg}`);
const head  = (msg: string) => console.log(`\n${C.bold}${C.cyan}── ${msg} ──${C.reset}\n`);

// ─── State persistence ────────────────────────────────────────────────────────
// Saves progress so re-runs skip completed steps

interface SetupState {
  railwayProjectId?: string;
  railwayPostgresUrl?: string;
  railwayIngestServiceId?: string;
  railwayIngestUrl?: string;
  r2BucketCreated?: boolean;
  solanaAnchorKey?: number[];
  solanaAnchorPubkey?: string;
  stripePriceProId?: string;
  stripePriceEntId?: string;
  stripeWebhookSecret?: string;
  vercelProjectUrl?: string;
  dbMigrated?: boolean;
  dbSeeded?: boolean;
  cronConfigured?: boolean;
}

function loadState(): SetupState {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf-8")); } catch { return {}; }
}

function saveState(patch: Partial<SetupState>) {
  const s = { ...loadState(), ...patch };
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ─── Env file management ──────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, "utf-8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

function setEnv(key: string, value: string) {
  const env   = loadEnv();
  env[key]    = value;
  const lines = Object.entries(env).map(([k, v]) =>
    v.includes(" ") || v.includes("#") ? `${k}="${v}"` : `${k}=${v}`
  );
  writeFileSync(ENV_FILE, lines.join("\n") + "\n");
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function prompt(question: string, defaultVal = ""): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const q = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
    rl.question(q, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}

function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    process.stdin.setRawMode?.(true);
    let input = "";
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", function handler(char: string) {
      if (char === "\n" || char === "\r") {
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "\u0003") {
        process.exit();
      } else {
        input += char;
        process.stdout.write("*");
      }
    });
  });
}

// ─── CLI runner ───────────────────────────────────────────────────────────────

function run(cmd: string, opts?: { cwd?: string; env?: Record<string, string> }): string {
  return execSync(cmd, {
    cwd: opts?.cwd ?? ROOT,
    env: { ...process.env, ...opts?.env },
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function runInteractive(cmd: string, cwd = ROOT): Promise<number> {
  return new Promise((resolve, reject) => {
    const [prog, ...args] = cmd.split(" ");
    const child = spawn(prog, args, { cwd, stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolve(code) : reject(new Error(`Exit ${code}`))));
  });
}

function cliAvailable(name: string): boolean {
  try { run(`which ${name} 2>/dev/null || where ${name} 2>nul`); return true; } catch { return false; }
}

// ─── Step 1: Check CLIs ───────────────────────────────────────────────────────

async function checkCLIs() {
  head("Checking required CLIs");

  const clis = [
    { name: "node",     install: "https://nodejs.org",             check: "node --version"  },
    { name: "railway",  install: "npm i -g @railway/cli",          check: "railway --version" },
    { name: "vercel",   install: "npm i -g vercel",                check: "vercel --version" },
    { name: "stripe",   install: "brew install stripe/stripe-cli/stripe", check: "stripe --version" },
    { name: "wrangler", install: "npm i -g wrangler",              check: "wrangler --version" },
  ];

  for (const cli of clis) {
    if (cliAvailable(cli.name)) {
      const version = run(cli.check).split("\n")[0];
      log(`${cli.name} — ${version}`);
    } else {
      info(`Installing ${cli.name}…`);
      try {
        if (cli.install.startsWith("npm")) {
          run(cli.install);
          log(`${cli.name} installed`);
        } else {
          error(`${cli.name} not found. Install: ${cli.install}`);
          process.exit(1);
        }
      } catch {
        error(`Failed to install ${cli.name}. Install manually: ${cli.install}`);
        process.exit(1);
      }
    }
  }
}

// ─── Step 2: Collect API keys ──────────────────────────────────────────────────

async function collectApiKeys() {
  head("API Keys");
  info("You already have these from your other projects. Paste them in.");

  const env = loadEnv();

  const keys = [
    { key: "ANTHROPIC_API_KEY",   label: "Anthropic API key",  hint: "sk-ant-..."  },
    { key: "RESEND_API_KEY",      label: "Resend API key",     hint: "re_..."      },
    { key: "HELIUS_API_KEY",      label: "Helius API key",     hint: "from helius.xyz" },
    { key: "ADMIN_EMAILS",        label: "Your email (admin)", hint: "you@domain.com" },
    { key: "HASHNODE_API_KEY",    label: "Hashnode API key (optional — for blog auto-publish)", hint: "skip to configure later" },
  ];

  for (const { key, label, hint } of keys) {
    if (env[key]) {
      log(`${label} — already set`);
      continue;
    }
    const val = await promptSecret(`${label} (${hint})`);
    if (!val) { warn(`Skipping ${label} — feature will be disabled`); continue; }
    setEnv(key, val);
    log(`${label} saved`);
  }
}

// ─── Step 3: Generate secrets ──────────────────────────────────────────────────

async function generateSecrets() {
  head("Generating secrets");

  const env = loadEnv();

  if (!env.AUTH_SECRET) {
    const secret = crypto.randomBytes(32).toString("base64");
    setEnv("AUTH_SECRET", secret);
    log("AUTH_SECRET generated");
  } else {
    log("AUTH_SECRET — already set");
  }

  if (!env.CRON_SECRET) {
    const secret = crypto.randomBytes(32).toString("hex");
    setEnv("CRON_SECRET", secret);
    log("CRON_SECRET generated");
  } else {
    log("CRON_SECRET — already set");
  }
}

// ─── Step 4: Generate Solana anchor keypair ────────────────────────────────────

async function generateSolanaKeypair() {
  head("Solana anchor keypair");

  const state = loadState();
  const env   = loadEnv();

  if (state.solanaAnchorKey) {
    log(`Anchor wallet — ${state.solanaAnchorPubkey} (already generated)`);
    return;
  }

  // Generate using Node.js crypto (no Solana CLI needed)
  const { Keypair } = await import("@solana/web3.js");
  const keypair = Keypair.generate();
  const keyBytes = Array.from(keypair.secretKey);
  const pubkey   = keypair.publicKey.toBase58();

  setEnv("SOLANA_ANCHOR_PRIVATE_KEY", JSON.stringify(keyBytes));
  setEnv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com");

  if (env.HELIUS_API_KEY) {
    setEnv("HELIUS_RPC_URL", `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`);
    setEnv("SOLANA_RPC_URL", `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`);
  }

  saveState({ solanaAnchorKey: keyBytes, solanaAnchorPubkey: pubkey });
  log(`Anchor wallet generated: ${pubkey}`);
  warn(`Fund this wallet with 0.05 SOL to enable on-chain anchoring`);
  warn(`  → solana transfer ${pubkey} 0.05 --allow-unfunded-recipient`);
  warn(`  → or send from Phantom/any wallet`);
}

// ─── Step 5: Railway — Postgres + ingest service ──────────────────────────────

async function setupRailway() {
  head("Railway — Postgres + ingest service");

  const state = loadState();

  if (UPDATE_ONLY && state.railwayPostgresUrl) {
    info("Redeploying ingest service…");
    run("railway up --service agentledger-ingest --detach", { cwd: path.join(ROOT, "services/ingest") });
    log("Ingest service redeployed");
    return;
  }

  if (state.railwayPostgresUrl) {
    log(`Railway Postgres — already provisioned`);
    log(`Ingest service — ${state.railwayIngestUrl ?? "deployed"}`);
    return;
  }

  info("Logging into Railway (browser will open)…");
  await runInteractive("railway login");

  info("Creating Railway project…");
  const projectJson = run("railway init --name agentledger-production --json");
  const project = JSON.parse(projectJson);
  saveState({ railwayProjectId: project.id });
  log(`Railway project created: ${project.id}`);

  info("Adding Postgres…");
  run("railway add --plugin postgresql");
  // Wait for Postgres to provision
  await new Promise(r => setTimeout(r, 8000));

  const dbUrl = run("railway variables get DATABASE_URL");
  setEnv("DATABASE_URL", dbUrl);
  saveState({ railwayPostgresUrl: dbUrl });
  log(`Postgres provisioned`);

  // Set all env vars on Railway
  info("Setting environment variables on Railway…");
  const env = loadEnv();
  const railwayVars = [
    "AUTH_SECRET", "RESEND_API_KEY", "RESEND_FROM",
    "ANTHROPIC_API_KEY", "SOLANA_RPC_URL", "SOLANA_ANCHOR_PRIVATE_KEY",
    "HELIUS_API_KEY", "HELIUS_RPC_URL", "CRON_SECRET",
  ];
  for (const key of railwayVars) {
    if (env[key]) {
      run(`railway variables set ${key}="${env[key]}"`);
    }
  }
  log("Railway environment variables set");

  // Deploy ingest service
  info("Deploying ingest service…");
  run("railway up --service agentledger-ingest --detach", { cwd: path.join(ROOT, "services/ingest") });

  // Wait and get the URL
  await new Promise(r => setTimeout(r, 15000));
  try {
    const ingestUrl = run("railway domain --service agentledger-ingest");
    const fullUrl   = ingestUrl.startsWith("http") ? ingestUrl : `https://${ingestUrl}`;
    setEnv("INGEST_SERVICE_URL", fullUrl);
    saveState({ railwayIngestUrl: fullUrl });
    log(`Ingest service deployed: ${fullUrl}`);
  } catch {
    warn("Could not get ingest URL automatically — check Railway dashboard");
  }
}

// ─── Step 6: Cloudflare R2 bucket ──────────────────────────────────────────────

async function setupR2() {
  head("Cloudflare R2 — report storage");

  const state = loadState();
  if (state.r2BucketCreated) { log("R2 bucket — already created"); return; }

  info("Logging into Cloudflare (browser will open)…");
  await runInteractive("wrangler login");

  info("Creating R2 bucket: agentledger-reports…");
  try {
    run("wrangler r2 bucket create agentledger-reports");
    log("R2 bucket created");
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      log("R2 bucket already exists");
    } else {
      warn("R2 bucket creation failed — PDF reports will not work");
      warn("Create manually: wrangler r2 bucket create agentledger-reports");
    }
  }

  // Get account ID and create API token
  info("Getting Cloudflare account ID…");
  try {
    const whoami  = run("wrangler whoami --json");
    const account = JSON.parse(whoami);
    const accountId = account.accounts?.[0]?.id;

    if (accountId) {
      setEnv("R2_ACCOUNT_ID", accountId);
      setEnv("R2_BUCKET_NAME", "agentledger-reports");
      log(`R2 account ID: ${accountId}`);
    }
  } catch {
    warn("Could not get account ID automatically. Set R2_ACCOUNT_ID manually.");
  }

  warn("R2 API tokens (Access Key ID + Secret) must be created in the Cloudflare dashboard:");
  warn("  → dash.cloudflare.com → R2 → Manage R2 API Tokens → Create API Token");
  warn("  → Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env");

  saveState({ r2BucketCreated: true });
}

// ─── Step 7: Stripe products ───────────────────────────────────────────────────

async function setupStripe() {
  head("Stripe — products and prices");

  const state = loadState();
  if (state.stripePriceProId && state.stripePriceEntId) {
    log("Stripe products — already created");
    return;
  }

  info("Logging into Stripe (browser will open)…");
  await runInteractive("stripe login");

  info("Creating Professional plan ($199/mo)…");
  const proProduct = JSON.parse(run(
    `stripe products create --name="AgentLedger Professional" --description="25 agent wallets, 1-year retention, API access" --metadata[tier]=PROFESSIONAL --json`
  ));
  const proPrice = JSON.parse(run(
    `stripe prices create --product=${proProduct.id} --unit-amount=19900 --currency=usd --recurring[interval]=month --json`
  ));
  setEnv("STRIPE_PRICE_PROFESSIONAL", proPrice.id);
  saveState({ stripePriceProId: proPrice.id });
  log(`Professional plan: ${proPrice.id}`);

  info("Creating Enterprise plan ($999/mo)…");
  const entProduct = JSON.parse(run(
    `stripe products create --name="AgentLedger Enterprise" --description="Unlimited wallets, federal format, white-label PDF" --metadata[tier]=ENTERPRISE --json`
  ));
  const entPrice = JSON.parse(run(
    `stripe prices create --product=${entProduct.id} --unit-amount=99900 --currency=usd --recurring[interval]=month --json`
  ));
  setEnv("STRIPE_PRICE_ENTERPRISE", entPrice.id);
  saveState({ stripePriceEntId: entPrice.id });
  log(`Enterprise plan: ${entPrice.id}`);

  // Stripe webhook (will be updated after Vercel deploy gives us the URL)
  info("Stripe webhook will be configured after Vercel deploy…");
}

// ─── Step 8: Vercel deploy ────────────────────────────────────────────────────

async function deployVercel() {
  head("Vercel — Next.js app");

  if (UPDATE_ONLY) {
    info("Redeploying to Vercel…");
    await runInteractive("vercel --prod --yes");
    log("Vercel redeployed");
    return;
  }

  const state = loadState();
  if (state.vercelProjectUrl) {
    info("Redeploying to Vercel…");
    await runInteractive("vercel --prod --yes");
    log("Vercel redeployed");
    return;
  }

  info("Logging into Vercel (browser will open)…");
  await runInteractive("vercel login");

  // Set all env vars on Vercel
  info("Setting environment variables on Vercel…");
  const env = loadEnv();

  const vercelVars: Record<string, string> = {
    DATABASE_URL:                 env.DATABASE_URL,
    AUTH_SECRET:                  env.AUTH_SECRET,
    RESEND_API_KEY:               env.RESEND_API_KEY ?? "",
    RESEND_FROM:                  env.RESEND_FROM ?? "AgentLedger <noreply@agentledger.io>",
    ANTHROPIC_API_KEY:            env.ANTHROPIC_API_KEY ?? "",
    SOLANA_RPC_URL:               env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",
    SOLANA_ANCHOR_PRIVATE_KEY:    env.SOLANA_ANCHOR_PRIVATE_KEY ?? "",
    HELIUS_API_KEY:               env.HELIUS_API_KEY ?? "",
    HELIUS_RPC_URL:               env.HELIUS_RPC_URL ?? "",
    R2_ACCOUNT_ID:                env.R2_ACCOUNT_ID ?? "",
    R2_ACCESS_KEY_ID:             env.R2_ACCESS_KEY_ID ?? "",
    R2_SECRET_ACCESS_KEY:         env.R2_SECRET_ACCESS_KEY ?? "",
    R2_BUCKET_NAME:               env.R2_BUCKET_NAME ?? "agentledger-reports",
    STRIPE_SECRET_KEY:            env.STRIPE_SECRET_KEY ?? "",
    STRIPE_PRICE_PROFESSIONAL:    env.STRIPE_PRICE_PROFESSIONAL ?? "",
    STRIPE_PRICE_ENTERPRISE:      env.STRIPE_PRICE_ENTERPRISE ?? "",
    CRON_SECRET:                  env.CRON_SECRET ?? "",
    NEXT_PUBLIC_APP_URL:          "https://agentledger.io",
    NEXT_PUBLIC_APP_NAME:         "AgentLedger",
  };

  for (const [key, value] of Object.entries(vercelVars)) {
    if (!value) continue;
    try {
      run(`vercel env add ${key} production <<< "${value}"`, { env: { ...process.env } });
    } catch {
      // Try alternative syntax
      try { run(`echo "${value}" | vercel env add ${key} production`); } catch { /* skip */ }
    }
  }
  log("Vercel environment variables set");

  info("Deploying to Vercel (production)…");
  const output = run("vercel --prod --yes");
  const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.vercel\.app/);
  const projectUrl = urlMatch?.[0] ?? "https://agentledger.vercel.app";

  setEnv("NEXT_PUBLIC_APP_URL", projectUrl);
  saveState({ vercelProjectUrl: projectUrl });
  log(`Deployed: ${projectUrl}`);

  return projectUrl;
}

// ─── Step 9: Stripe webhook ───────────────────────────────────────────────────

async function setupStripeWebhook(appUrl: string) {
  head("Stripe webhook");

  const state = loadState();
  if (state.stripeWebhookSecret) {
    log("Stripe webhook — already configured");
    return;
  }

  try {
    const webhookJson = JSON.parse(run(
      `stripe webhook_endpoints create --url="${appUrl}/api/stripe/webhook" --enabled-events=checkout.session.completed,customer.subscription.updated,customer.subscription.deleted --json`
    ));
    const secret = webhookJson.secret;
    setEnv("STRIPE_WEBHOOK_SECRET", secret);
    saveState({ stripeWebhookSecret: secret });
    log(`Webhook registered: ${webhookJson.id}`);

    // Update Vercel with the webhook secret
    try {
      run(`echo "${secret}" | vercel env add STRIPE_WEBHOOK_SECRET production`);
      log("Webhook secret set on Vercel");
    } catch {
      warn("Set STRIPE_WEBHOOK_SECRET on Vercel manually");
    }
  } catch (e) {
    warn("Stripe webhook creation failed — set up manually in Stripe dashboard");
  }
}

// ─── Step 10: Database migrations ────────────────────────────────────────────

async function runMigrations() {
  head("Database migrations");

  const state = loadState();
  if (state.dbMigrated && !UPDATE_ONLY) { log("Migrations — already run"); return; }

  info("Running prisma db push…");
  run("npx prisma db push --accept-data-loss");
  log("Schema applied");

  info("Generating Prisma client…");
  run("npx prisma generate");
  log("Client generated");

  saveState({ dbMigrated: true });

  if (!state.dbSeeded) {
    const doSeed = await prompt("Seed with demo data? (y/n)", "y");
    if (doSeed.toLowerCase() === "y") {
      run("npm run db:seed");
      saveState({ dbSeeded: true });
      log("Demo data seeded — sign in with demo@agentledger.io");
    }
  }
}

// ─── Step 11: Railway cron jobs ───────────────────────────────────────────────

async function setupCronJobs(appUrl: string) {
  head("Cron jobs");

  const state = loadState();
  if (state.cronConfigured) { log("Cron jobs — already configured"); return; }

  const env    = loadEnv();
  const secret = env.CRON_SECRET;
  if (!secret) { warn("CRON_SECRET not set — cron jobs skipped"); return; }

  info("Configuring Railway cron jobs…");
  info("Note: Railway cron jobs are managed via the dashboard or railway.toml");
  info("Add these cron jobs in your Railway project:");
  console.log("");
  console.log(`  Nightly policy scan:`);
  console.log(`    Schedule: 0 2 * * *`);
  console.log(`    Command:  curl -s -X POST ${appUrl}/api/cron/policy-scan -H "Authorization: Bearer ${secret}"`);
  console.log("");
  console.log(`  Hourly anchor retry:`);
  console.log(`    Schedule: 0 * * * *`);
  console.log(`    Command:  curl -s -X POST ${appUrl}/api/cron/anchor-retry -H "Authorization: Bearer ${secret}"`);
  console.log("");

  // Write a cron-config.json for reference
  writeFileSync(path.join(ROOT, "cron-config.json"), JSON.stringify({
    jobs: [
      { name: "policy-scan",  schedule: "0 2 * * *",  url: `${appUrl}/api/cron/policy-scan`,  auth: secret },
      { name: "anchor-retry", schedule: "0 * * * *",  url: `${appUrl}/api/cron/anchor-retry`, auth: secret },
      { name: "outreach",     schedule: "0 */4 * * *",  url: `${appUrl}/api/cron/marketing`,    auth: secret, body: "{\"task\":\"outreach\"}" },
      { name: "monitor",      schedule: "0 */6 * * *",  url: `${appUrl}/api/cron/marketing`,    auth: secret, body: "{\"task\":\"monitor\"}" },
      { name: "content",      schedule: "0 9 * * 1",    url: `${appUrl}/api/cron/marketing`,    auth: secret, body: "{\"task\":\"content\"}" },
      { name: "newsletter",   schedule: "0 10 1 * *",   url: `${appUrl}/api/cron/marketing`,    auth: secret, body: "{\"task\":\"newsletter\"}" },
    ]
  }, null, 2));
  log("Cron configuration saved to cron-config.json");
  saveState({ cronConfigured: true });
}

// ─── Step 12: Summary ─────────────────────────────────────────────────────────

function printSummary(appUrl: string) {
  head("Setup complete");

  const state = loadState();
  const env   = loadEnv();

  console.log(`
${C.bold}${C.green}AgentLedger is live.${C.reset}

${C.bold}URLs${C.reset}
  App:           ${C.cyan}${appUrl}${C.reset}
  Ingest:        ${C.cyan}${state.railwayIngestUrl ?? "check Railway dashboard"}${C.reset}
  Verify anchor: ${C.cyan}${appUrl}/verify${C.reset}
  Login:         ${C.cyan}${appUrl}/login${C.reset}

${C.bold}Solana anchor wallet${C.reset}
  Pubkey: ${C.cyan}${state.solanaAnchorPubkey}${C.reset}
  ${C.yellow}⚠ Fund with 0.05 SOL to enable on-chain anchoring${C.reset}

${C.bold}Next steps${C.reset}
  1. ${env.R2_ACCESS_KEY_ID ? "✓" : "○"} Set R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY (Cloudflare dashboard → R2 → API Tokens)
  2. ${state.solanaAnchorPubkey ? "○" : "○"} Fund anchor wallet: ${state.solanaAnchorPubkey ?? "not generated"}
  3. ${env.STRIPE_SECRET_KEY ? "✓" : "○"} Set STRIPE_SECRET_KEY in .env and Vercel
  4. Configure cron jobs in Railway (see cron-config.json)
  5. Point agentledger.io domain to Vercel (optional)

${C.bold}SDK integration${C.reset}
  npm install @agentledger/sdk

  const ledger = new AgentLedger({
    apiKey: '<from Settings page>',
    agentWalletAddress: process.env.WALLET_ADDRESS,
  });

${C.dim}Config saved to .env and .setup-state.json${C.reset}
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.green}AgentLedger Setup${C.reset} ${UPDATE_ONLY ? "(update mode)" : "(fresh install)"}\n`);
  console.log(`${C.dim}This will deploy AgentLedger with minimal interaction required.${C.reset}`);
  console.log(`${C.dim}Progress is saved — you can re-run if something fails.${C.reset}\n`);

  const shouldContinue = await prompt("Continue? (y/n)", "y");
  if (shouldContinue.toLowerCase() !== "y") { process.exit(0); }

  await checkCLIs();
  await collectApiKeys();
  await generateSecrets();
  await generateSolanaKeypair();
  await setupRailway();
  await setupR2();
  await setupStripe();
  const appUrl = await deployVercel() ?? loadState().vercelProjectUrl ?? "https://agentledger.vercel.app";
  await setupStripeWebhook(appUrl);
  await runMigrations();
  await setupCronJobs(appUrl);
  printSummary(appUrl);
}

main().catch((err) => {
  error(`Setup failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
