#!/usr/bin/env node
/**
 * Seeds default outreach sequences with real email templates.
 * Run: npm run seed:sequences
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEQUENCES = [
  {
    name: "New User Onboarding",
    description: "Welcome + activation sequence for new signups",
    targetAudience: "enterprise",
    steps: [
      { delayDays: 0,  label: "Welcome + SDK quick start" },
      { delayDays: 3,  label: "Authorization records explainer" },
      { delayDays: 7,  label: "Audit package demo" },
      { delayDays: 14, label: "Upgrade check-in" },
    ],
  },
  {
    name: "Federal Contractor Outreach",
    description: "CMMC/NIST angle for defense IT contractors",
    targetAudience: "federal",
    steps: [
      { delayDays: 0, label: "CMMC AI agent gap" },
      { delayDays: 5, label: "Specific C3PAO example" },
      { delayDays: 9, label: "Soft close" },
    ],
  },
  {
    name: "Solana Builder Outreach",
    description: "Production compliance for Agent Registry builders",
    targetAudience: "solana",
    steps: [
      { delayDays: 0,  label: "Production compliance intro" },
      { delayDays: 6,  label: "SDK integration offer" },
      { delayDays: 10, label: "MCP server fallback" },
    ],
  },
  {
    name: "Enterprise AI Ops Outreach",
    description: "CFO/legal governance angle for enterprise agent operators",
    targetAudience: "enterprise",
    steps: [
      { delayDays: 0, label: "Agent governance problem" },
      { delayDays: 5, label: "Audit package example" },
      { delayDays: 8, label: "ROI / upgrade" },
    ],
  },
];

async function main() {
  for (const seq of SEQUENCES) {
    const existing = await prisma.outreachSequence.findFirst({ where: { name: seq.name } });
    if (existing) { console.log(`Skip (exists): ${seq.name}`); continue; }
    await prisma.outreachSequence.create({ data: seq });
    console.log(`Created: ${seq.name}`);
  }
  console.log("\nDone. Run sequences from /admin or via cron.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
