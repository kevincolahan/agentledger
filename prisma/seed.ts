/**
 * Prisma seed for local development
 * Run: npm run db:seed
 *
 * Creates:
 *  - One demo organization (demo@agentledger.io)
 *  - Two agent wallets
 *  - Authorization records for each
 *  - Sample policy findings
 */

import { PrismaClient, AgentFramework, WalletStatus, FindingType, FindingSeverity } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding AgentLedger...");

  // Clean existing seed data
  await prisma.policyFinding.deleteMany({});
  await prisma.authorizationRecord.deleteMany({});
  await prisma.agentWallet.deleteMany({});
  await prisma.orgMember.deleteMany({});
  await prisma.organization.deleteMany({ where: { slug: { startsWith: "demo-" } } });
  await prisma.user.deleteMany({ where: { email: "demo@agentledger.io" } });

  // Create demo user + org
  const user = await prisma.user.create({
    data: {
      email: "demo@agentledger.io",
      name: "Demo User",
      emailVerified: new Date(),
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Acme AI Labs",
      slug: `demo-${user.id.slice(-6)}`,
      planTier: "PROFESSIONAL",
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  console.log(`✓  Org: ${org.name} (${org.id})`);

  // Agent 1 — Yield Optimizer
  const agent1 = await prisma.agentWallet.create({
    data: {
      orgId: org.id,
      walletAddress: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
      walletChain: "SOLANA",
      agentName: "Yield Optimizer",
      agentDescription: "Monitors DeFi yields and rebalances between Blueprint staking and Orca LP positions",
      framework: AgentFramework.SOLANA_AGENT_KIT,
      status: WalletStatus.ACTIVE,
    },
  });

  const recordHash1 = crypto
    .createHash("sha256")
    .update(JSON.stringify({ orgId: org.id, agentWalletId: agent1.id, v: 1 }))
    .digest("hex");

  await prisma.authorizationRecord.create({
    data: {
      agentWalletId: agent1.id,
      version: 1,
      maxTxValueUsd: 500,
      maxDailySpendUsd: 2000,
      whitelistedPrograms: [
        "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter
        "BluEFRoAvvhXDw4TfbRqzqyFIeJPuGVq5wTCDsv8tR5h", // Blueprint
        "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", // Orca
      ],
      permittedTxTypes: ["swap", "stake", "unstake"],
      operationalPurpose:
        "Automated yield optimization across Solana DeFi protocols. Agent monitors APY across Blueprint validator staking and Orca concentrated liquidity positions, rebalancing weekly or when yield differential exceeds 1.5%. Maximum position size $500 per transaction.",
      orgSignerPubkey: "platform",
      signature: `hmac_${recordHash1.slice(0, 32)}`,
      recordHash: recordHash1,
      effectiveFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    },
  });

  // Agent 2 — x402 API Gateway
  const agent2 = await prisma.agentWallet.create({
    data: {
      orgId: org.id,
      walletAddress: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
      walletChain: "SOLANA",
      agentName: "x402 API Gateway Agent",
      agentDescription: "Pays for AI inference and data APIs via x402 protocol using USDC",
      framework: AgentFramework.ELIZAOS,
      status: WalletStatus.ACTIVE,
    },
  });

  const recordHash2 = crypto
    .createHash("sha256")
    .update(JSON.stringify({ orgId: org.id, agentWalletId: agent2.id, v: 1 }))
    .digest("hex");

  const auth2 = await prisma.authorizationRecord.create({
    data: {
      agentWalletId: agent2.id,
      version: 1,
      maxTxValueUsd: 50,
      maxDailySpendUsd: 500,
      whitelistedPrograms: [],
      permittedTxTypes: ["x402_payment", "transfer"],
      operationalPurpose:
        "API payment agent for x402 protocol. Authorized to pay for LLM inference, data feeds, and computational resources via USDC payments on Solana. Maximum $50 per API call, $500 daily cap.",
      orgSignerPubkey: "platform",
      signature: `hmac_${recordHash2.slice(0, 32)}`,
      recordHash: recordHash2,
      effectiveFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
  });

  // Sample policy findings
  await prisma.policyFinding.createMany({
    data: [
      {
        agentWalletId: agent1.id,
        authorizationId: null,
        findingType: FindingType.EXCEEDED_TX_LIMIT,
        severity: FindingSeverity.HIGH,
        title: "Transaction exceeded authorized limit",
        description:
          "Transaction of $742.50 USD exceeded the authorized per-transaction limit of $500.00 USD. Authorization record v1 must be updated to permit transactions of this size.",
        txSignature: "5Tz3UePCQPJAqNqyXdBwg3Hk2rz2Zk6vJbE7dKmnpNTtBpCQijUnP7MFTq2BLXy4v8gNvJLtqG6PJKM4KeZz9uv",
        status: "OPEN",
        detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        agentWalletId: agent2.id,
        authorizationId: auth2.id,
        findingType: FindingType.ANOMALOUS_FREQUENCY,
        severity: FindingSeverity.MEDIUM,
        title: "Unusually high transaction frequency",
        description:
          "Agent x402 API Gateway Agent executed 67 transactions in the last 24 hours, exceeding the automated review threshold of 50/day. Verify this activity aligns with operational purpose.",
        status: "ACKNOWLEDGED",
        dispositionNotes: "Confirmed — marketing campaign caused 3x normal API traffic. Expected to normalize.",
        disposedAt: new Date(Date.now() - 30 * 60 * 1000),
        detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
    ],
  });

  console.log(`✓  Agents: ${agent1.agentName}, ${agent2.agentName}`);
  console.log(`✓  Authorization records: 2 created`);
  console.log(`✓  Policy findings: 2 seeded (1 open, 1 acknowledged)`);
  console.log("");
  console.log("Sign in at http://localhost:3000/login with: demo@agentledger.io");
  console.log("(Magic link will be logged to console in dev mode)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
