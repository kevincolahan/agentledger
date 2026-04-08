# AgentLedger SDK Skill

Adds compliance audit trail capture to any Solana AI agent. Every reasoning-to-transaction
chain is logged, Merkle-anchored on Solana, and available as a downloadable audit package.

## Install

```bash
# As a ClawHub/OpenClaw skill (agents can self-install)
npx skills add agentledger/audit-sdk

# Or via npm
npm install @agentledger/sdk
```

## Quick start (Solana Agent Kit)

```typescript
import { AgentLedger, hashContext, hashParams } from '@agentledger/sdk';

const ledger = new AgentLedger({
  apiKey: process.env.AGENTLEDGER_KEY,        // al_live_... from dashboard
  agentWalletAddress: process.env.WALLET_ADDRESS,
  framework: 'solana-agent-kit',
  debug: process.env.NODE_ENV === 'development',
});

// Wrap your action execution
const result = await ledger.executeWithAudit(
  'Swapping 50 USDC to SOL for staking yield rebalancing',
  async () => agentKit.swap({
    inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    outputMint: 'So11111111111111111111111111111111111111112',   // SOL
    amount: 50,
  })
);

// End session when agent shuts down — triggers Merkle anchoring
process.on('SIGTERM', () => ledger.endSession());
```

## Manual logging (advanced)

```typescript
// Log reasoning before action
const eventId = await ledger.logReasoning({
  summary: 'Detected yield opportunity on Blueprint validator — initiating stake',
  contextHash: hashContext(fullPromptString), // sha256, not the raw prompt
});

// Log the action result
await ledger.logAction({
  reasoningEventId: eventId,
  toolName: 'stake',
  txSignature: result.txSignature,
  onChainProgram: 'BluEFRoAvvhXDw4TfbRqzqyFIeJPuGVq5wTCDsv8tR5h',
  amountUsd: 142.50,
});
```

## ElizaOS plugin

```typescript
import { createElizaOSPlugin } from '@agentledger/sdk';

// In your character setup
const plugins = [
  createElizaOSPlugin({
    apiKey: process.env.AGENTLEDGER_KEY,
    agentWalletAddress: process.env.WALLET_ADDRESS,
  }),
  // ... other plugins
];
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `AGENTLEDGER_KEY` | API key from AgentLedger dashboard (al_live_...) |
| `AGENTLEDGER_INGEST_URL` | Override ingest URL (optional, for self-hosted) |

## What gets sent to AgentLedger

- Reasoning summaries (the agent's stated intent)
- SHA-256 hashes of prompt context (never the raw prompt)
- SHA-256 hashes of tool parameters (never raw params)  
- Solana transaction signatures (public information)
- Tool names and on-chain program IDs
- USD values at time of transaction

Raw prompts, private keys, and wallet seeds are never sent.
