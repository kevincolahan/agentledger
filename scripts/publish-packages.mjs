#!/usr/bin/env node
/**
 * Publish @agentledger/sdk and @agentledger/mcp to npm.
 *
 * Usage:
 *   node scripts/publish-packages.mjs           # publish both
 *   node scripts/publish-packages.mjs --sdk     # SDK only
 *   node scripts/publish-packages.mjs --mcp     # MCP only
 *   node scripts/publish-packages.mjs --dry-run # dry run
 *
 * CI: triggered automatically when commit message contains [publish-sdk] or [publish-mcp]
 * Manual: npm run publish:packages
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

const SDK_ONLY  = process.argv.includes("--sdk");
const MCP_ONLY  = process.argv.includes("--mcp");
const DRY_RUN   = process.argv.includes("--dry-run");

const log  = (m) => console.log(`\x1b[32m✓\x1b[0m  ${m}`);
const info = (m) => console.log(`\x1b[36m→\x1b[0m  ${m}`);
const warn = (m) => console.log(`\x1b[33m⚠\x1b[0m  ${m}`);

function run(cmd, cwd = ROOT) {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe","pipe","pipe"] }).trim();
}

function bumpVersion(pkgPath) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const [major, minor, patch] = pkg.version.split(".").map(Number);
  pkg.version = `${major}.${minor}.${patch + 1}`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  return pkg.version;
}

async function publishPackage(name, dir) {
  info(`Publishing ${name}…`);

  const pkgPath = path.join(dir, "package.json");
  const newVersion = bumpVersion(pkgPath);
  log(`Bumped to ${newVersion}`);

  // Build
  info(`Building ${name}…`);
  run("npm ci", dir);
  run("npm run build", dir);
  log(`Built ${name}`);

  // Publish
  const dryFlag = DRY_RUN ? "--dry-run" : "";
  run(`npm publish --access public ${dryFlag}`, dir);
  log(`Published ${name}@${newVersion}${DRY_RUN ? " (dry run)" : ""}`);

  // Commit version bump
  if (!DRY_RUN) {
    try {
      run(`git add ${path.relative(ROOT, pkgPath)}`);
      run(`git commit -m "chore: bump ${name} to ${newVersion}"`);
    } catch { warn("Git commit failed — commit the version bump manually"); }
  }

  return newVersion;
}

async function main() {
  const publishBoth = !SDK_ONLY && !MCP_ONLY;

  if (publishBoth || SDK_ONLY) {
    await publishPackage("@agentledger/sdk", path.join(ROOT, "packages/sdk"));
  }

  if (publishBoth || MCP_ONLY) {
    await publishPackage("@agentledger/mcp", path.join(ROOT, "packages/mcp"));
  }

  console.log("\n\x1b[32m✓ Done\x1b[0m\n");
}

main().catch(err => { console.error(err); process.exit(1); });
