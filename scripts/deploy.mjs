#!/usr/bin/env node
/**
 * AgentLedger redeploy script
 * Pushes updates to both Vercel (web) and Railway (ingest) simultaneously
 *
 * Run: node scripts/deploy.js
 * Options:
 *   --web-only     Only deploy Next.js to Vercel
 *   --ingest-only  Only deploy ingest service to Railway
 *   --migrate      Also run prisma db push after deploy
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const WEB_ONLY    = process.argv.includes("--web-only");
const INGEST_ONLY = process.argv.includes("--ingest-only");
const MIGRATE     = process.argv.includes("--migrate");

const log  = (svc, msg) => console.log(`\x1b[36m[${svc}]\x1b[0m ${msg}`);
const ok   = (svc, msg) => console.log(`\x1b[32m[${svc}]\x1b[0m ${msg}`);
const err  = (svc, msg) => console.log(`\x1b[31m[${svc}]\x1b[0m ${msg}`);

function runProcess(name, cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    log(name, `${cmd} ${args.join(" ")}`);
    const child = spawn(cmd, args, { cwd, stdio: "pipe", shell: true });

    child.stdout.on("data", d => process.stdout.write(`\x1b[2m[${name}]\x1b[0m ${d}`));
    child.stderr.on("data", d => process.stderr.write(`\x1b[2m[${name}]\x1b[0m ${d}`));

    child.on("exit", code => {
      if (code === 0) { ok(name, "✓ Done"); resolve(); }
      else { err(name, `✗ Exit ${code}`); reject(new Error(`${name} exited ${code}`)); }
    });
  });
}

async function main() {
  const startTime = Date.now();
  console.log("\n\x1b[1m\x1b[32mAgentLedger Deploy\x1b[0m\n");

  const jobs = [];

  if (!INGEST_ONLY) {
    jobs.push(
      runProcess("web", "npx", ["prisma", "generate"], ROOT)
        .then(() => runProcess("web", "vercel", ["--prod", "--yes"], ROOT))
    );
  }

  if (!WEB_ONLY) {
    jobs.push(
      runProcess("ingest", "npm", ["ci"], path.join(ROOT, "services/ingest"))
        .then(() => runProcess("ingest", "railway", ["up", "--service", "agentledger-ingest", "--detach"], path.join(ROOT, "services/ingest")))
    );
  }

  await Promise.all(jobs);

  if (MIGRATE) {
    console.log("\nRunning migrations…");
    await runProcess("migrate", "npx", ["prisma", "db", "push", "--accept-data-loss"], ROOT);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\x1b[32m✓ Deploy complete in ${elapsed}s\x1b[0m\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
