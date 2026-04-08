import { NextResponse } from "next/server";

// GET /api/authorization-templates
// Returns pre-built authorization record templates
// No auth required — these are public reference templates

export interface AuthTemplate {
  id: string;
  name: string;
  description: string;
  category: "defi" | "nft" | "payments" | "governance" | "infrastructure";
  operationalPurpose: string;
  maxTxValueUsd: number | null;
  maxDailySpendUsd: number | null;
  permittedTxTypes: string[];
  whitelistedPrograms: { address: string; label: string }[];
  frameworks: string[];
  riskLevel: "low" | "medium" | "high";
}

const TEMPLATES: AuthTemplate[] = [
  {
    id: "yield-optimizer",
    name: "Yield Optimizer",
    description: "Automated yield optimization across Solana DeFi protocols",
    category: "defi",
    operationalPurpose:
      "Automated yield optimization agent. Authorized to swap tokens between yield-bearing assets via Jupiter aggregator and stake/unstake SOL via Blueprint and Marinade validators. Rebalances weekly or when yield differential exceeds 1.5% APY. All swaps limited to liquid assets with >$1M daily volume.",
    maxTxValueUsd: 500,
    maxDailySpendUsd: 2000,
    permittedTxTypes: ["swap", "stake", "unstake"],
    whitelistedPrograms: [
      { address: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", label: "Jupiter Aggregator v6" },
      { address: "BluEFRoAvvhXDw4TfbRqzqyFIeJPuGVq5wTCDsv8tR5h", label: "Blueprint Staking" },
      { address: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",  label: "Marinade Finance" },
    ],
    frameworks: ["solana-agent-kit", "elizaos"],
    riskLevel: "medium",
  },
  {
    id: "x402-api-gateway",
    name: "x402 API Payment Agent",
    description: "Pays for AI inference and data APIs via x402 protocol",
    category: "payments",
    operationalPurpose:
      "API payment agent for x402 protocol. Authorized to make USDC payments for AI inference, data feeds, and computational resources. Each payment represents consumption of a paid API endpoint. No speculative transactions. USDC only.",
    maxTxValueUsd: 50,
    maxDailySpendUsd: 500,
    permittedTxTypes: ["x402_payment", "transfer"],
    whitelistedPrograms: [],
    frameworks: ["elizaos", "custom"],
    riskLevel: "low",
  },
  {
    id: "portfolio-rebalancer",
    name: "Portfolio Rebalancer",
    description: "Maintains target allocation across a multi-asset portfolio",
    category: "defi",
    operationalPurpose:
      "Portfolio rebalancing agent. Authorized to swap between pre-approved tokens (SOL, USDC, JitoSOL, mSOL) to maintain target allocation within ±5% of targets. Rebalances triggered only when drift exceeds threshold. No leverage, no derivatives, no new asset types.",
    maxTxValueUsd: 1000,
    maxDailySpendUsd: 5000,
    permittedTxTypes: ["swap", "stake", "unstake"],
    whitelistedPrograms: [
      { address: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", label: "Jupiter Aggregator v6" },
      { address: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", label: "Jito Staking" },
      { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", label: "Marinade mSOL" },
    ],
    frameworks: ["solana-agent-kit", "goat"],
    riskLevel: "medium",
  },
  {
    id: "nft-collection-manager",
    name: "NFT Collection Manager",
    description: "Mints and manages NFTs within a defined collection",
    category: "nft",
    operationalPurpose:
      "NFT collection management agent. Authorized to mint NFTs under a pre-approved Candy Machine and manage metadata via Metaplex Token Metadata program. No transfers of held NFTs without explicit instruction. Minting limited to defined collection only.",
    maxTxValueUsd: 100,
    maxDailySpendUsd: 500,
    permittedTxTypes: ["nft_mint"],
    whitelistedPrograms: [
      { address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",   label: "Metaplex Token Metadata" },
      { address: "CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR", label: "Candy Machine v3" },
    ],
    frameworks: ["solana-agent-kit", "elizaos"],
    riskLevel: "low",
  },
  {
    id: "dao-delegate",
    name: "DAO Voting Delegate",
    description: "Casts governance votes on behalf of a delegating address",
    category: "governance",
    operationalPurpose:
      "DAO governance delegate. Authorized to cast votes on Realms governance proposals per pre-defined voting policy. Votes only on proposals matching pre-approved topic categories. No token transfers or treasury actions without explicit human approval.",
    maxTxValueUsd: null,
    maxDailySpendUsd: null,
    permittedTxTypes: ["governance_vote"],
    whitelistedPrograms: [
      { address: "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPiCXLf", label: "SPL Governance" },
    ],
    frameworks: ["custom"],
    riskLevel: "low",
  },
  {
    id: "liquidity-provider",
    name: "Liquidity Provider",
    description: "Manages concentrated liquidity positions on Orca / Raydium",
    category: "defi",
    operationalPurpose:
      "Concentrated liquidity management agent. Authorized to open, adjust, and close liquidity positions on approved DEX pools. Rebalances ranges when price exits current range. Compounds earned fees daily. Limited to approved trading pairs (SOL/USDC, SOL/USDT).",
    maxTxValueUsd: 2000,
    maxDailySpendUsd: 10000,
    permittedTxTypes: ["swap", "liquidity_add", "liquidity_remove"],
    whitelistedPrograms: [
      { address: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",  label: "Orca Whirlpools" },
      { address: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", label: "Raydium AMM" },
    ],
    frameworks: ["solana-agent-kit", "goat"],
    riskLevel: "high",
  },
  {
    id: "treasury-manager",
    name: "Treasury Manager",
    description: "Manages a multi-asset treasury with yield optimization",
    category: "defi",
    operationalPurpose:
      "Enterprise treasury management agent. Authorized to allocate idle treasury funds into yield-bearing positions (staking, lending), sweep earned yield to operational wallet, and rebalance between approved assets per investment policy statement. All actions logged for accounting purposes.",
    maxTxValueUsd: 5000,
    maxDailySpendUsd: 20000,
    permittedTxTypes: ["swap", "stake", "unstake", "transfer"],
    whitelistedPrograms: [
      { address: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", label: "Jupiter Aggregator v6" },
      { address: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",  label: "Marinade Finance" },
      { address: "BluEFRoAvvhXDw4TfbRqzqyFIeJPuGVq5wTCDsv8tR5h", label: "Blueprint Staking" },
    ],
    frameworks: ["solana-agent-kit", "elizaos", "goat"],
    riskLevel: "high",
  },
  {
    id: "monitoring-only",
    name: "Read-Only Monitor",
    description: "Monitoring agent with no transaction permissions",
    category: "infrastructure",
    operationalPurpose:
      "Monitoring and alerting agent. Authorized to read on-chain state (balances, positions, prices) and report status. No transaction execution permissions. Used for dashboards, alerts, and reporting only.",
    maxTxValueUsd: 0,
    maxDailySpendUsd: 0,
    permittedTxTypes: [],
    whitelistedPrograms: [],
    frameworks: ["custom", "elizaos"],
    riskLevel: "low",
  },
];

export async function GET() {
  return NextResponse.json({ templates: TEMPLATES });
}
