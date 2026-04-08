#!/usr/bin/env node
/**
 * Submit AgentLedger to awesome-solana-ai
 *
 * Forks the repo, adds the entries, and opens a PR — all automated.
 * Run: node scripts/submit-ecosystem.js
 *
 * Requires: gh CLI (GitHub CLI) installed and authenticated
 */

import { execSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe","pipe","pipe"], ...opts }).trim();
}

const log   = (m) => console.log(`✓  ${m}`);
const info  = (m) => console.log(`→  ${m}`);
const warn  = (m) => console.log(`⚠  ${m}`);

async function main() {
  console.log("\nAgentLedger → awesome-solana-ai PR\n");

  // Check gh CLI
  try { run("gh --version"); log("GitHub CLI available"); }
  catch { warn("GitHub CLI not found. Install: https://cli.github.com\nOr submit manually: https://github.com/solana-foundation/awesome-solana-ai"); process.exit(1); }

  // Check auth
  try { run("gh auth status"); log("GitHub CLI authenticated"); }
  catch { run("gh auth login", { stdio: "inherit" }); }

  info("Forking solana-foundation/awesome-solana-ai…");
  try { run("gh repo fork solana-foundation/awesome-solana-ai --clone=true --remote=true"); log("Forked"); }
  catch { log("Fork already exists"); }

  const dir = path.join(__dirname, "..", "..", "awesome-solana-ai");
  mkdirSync(dir, { recursive: true });

  try { run(`git -C "${dir}" pull upstream main`); }
  catch { run(`git -C "${dir}" pull origin main`); }

  // Read the README and add entries
  const readmePath = path.join(dir, "README.md");
  let readme = readFileSync(readmePath, "utf-8");

  const SDK_ENTRY = `
- **@agentledger/sdk** — SDK for compliance audit trails on Solana AI agents. Captures reasoning-to-transaction chains, Merkle-anchors audit sessions on-chain, and produces CPA-ready tax reports and CMMC-formatted compliance packages. Compatible with ElizaOS, Solana Agent Kit, GOAT, and custom runtimes. [npm](https://npmjs.com/package/@agentledger/sdk) | [Docs](https://agentledger.io)`;

  const MCP_ENTRY = `
- **@agentledger/mcp** — MCP server giving any Claude Code agent compliance superpowers: authorization checks, audit trail logging, on-chain anchor verification, policy findings, and audit report generation for Solana agent operators. [npm](https://npmjs.com/package/@agentledger/mcp) | [ClawHub](https://clawhub.io/skills/agentledger/mcp)`;

  // Add SDK to Tools section
  if (!readme.includes("@agentledger/sdk")) {
    readme = readme.replace(
      "## 🛠️ Tools",
      `## 🛠️ Tools\n${SDK_ENTRY}`
    );
    if (!readme.includes("@agentledger/sdk")) {
      // Try alternate section name
      readme = readme.replace(
        "## Tools",
        `## Tools\n${SDK_ENTRY}`
      );
    }
    log("Added @agentledger/sdk entry");
  } else { log("@agentledger/sdk already listed"); }

  // Add MCP to MCP Servers section
  if (!readme.includes("@agentledger/mcp")) {
    readme = readme.replace(
      "## 🤖 MCP Servers",
      `## 🤖 MCP Servers\n${MCP_ENTRY}`
    );
    if (!readme.includes("@agentledger/mcp")) {
      readme = readme.replace("## MCP Servers", `## MCP Servers\n${MCP_ENTRY}`);
    }
    log("Added @agentledger/mcp entry");
  } else { log("@agentledger/mcp already listed"); }

  writeFileSync(readmePath, readme);

  // Commit and push
  const branch = "add-agentledger";
  run(`git -C "${dir}" checkout -b ${branch}`, { stdio: "pipe" });
  run(`git -C "${dir}" add README.md`);
  run(`git -C "${dir}" commit -m "Add AgentLedger — compliance audit layer for Solana AI agents"`);
  run(`git -C "${dir}" push origin ${branch}`);
  log("Pushed branch");

  // Open PR
  const prUrl = run(
    `gh pr create --repo solana-foundation/awesome-solana-ai \
      --title "Add AgentLedger — compliance audit layer for Solana AI agents" \
      --body "## AgentLedger

AgentLedger is the compliance and audit layer for enterprise AI agent operators on Solana.

### What it does
- **Authorization records**: Signed, on-chain-anchored scope documents per agent wallet (ERC-8004 Agent Registry compatible)
- **Decision audit trail**: Reasoning-to-transaction Merkle-anchored chain — the \\"why\\" behind each transaction
- **Policy engine**: Claude-powered nightly compliance scanning against authorization scope
- **Tax reporting**: Per-wallet cost basis per IRS 2026 rules, staking income, x402 API fee classification
- **Audit packages**: Single-click PDF with NIST SP 800-53 / CMMC formatting option

### Packages
- \`@agentledger/sdk\` — Drop-in for ElizaOS, Solana Agent Kit, GOAT, custom runtimes (~6 lines)
- \`@agentledger/mcp\` — MCP server for Claude Code and OpenClaw agents

### Why Solana
Solana's Agent Registry (ERC-8004) provides the identity layer. AgentLedger is the compliance layer on top. As enterprises deploy agents that transact autonomously, they need documented proof of authorization — especially for CMMC assessments and board-level governance.

Website: https://agentledger.io
Docs: https://agentledger.io/docs" \
      --base main \
      --head $(gh api user --jq .login):${branch}`
  );

  log(`PR opened: ${prUrl}`);
  console.log(`\n✓ Done. PR submitted to awesome-solana-ai.\n`);
}

main().catch(console.error);
