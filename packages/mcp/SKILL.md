# AgentLedger MCP Server

Gives any AI agent compliance superpowers: authorization checks, audit trail logging, policy findings, and on-chain anchor verification for Solana agent operators.

## Install (Claude Code / OpenClaw)

```bash
# Via ClawHub (recommended — self-installs)
npx skills add agentledger/mcp

# Or add to Claude Code MCP settings:
```

```json
{
  "mcpServers": {
    "agentledger": {
      "command": "npx",
      "args": ["-y", "@agentledger/mcp"],
      "env": {
        "AGENTLEDGER_KEY": "al_live_...",
        "AGENTLEDGER_URL": "https://agentledger.io"
      }
    }
  }
}
```

## Environment variables

| Variable | Description |
|---|---|
| `AGENTLEDGER_KEY` | API key from Settings page (al_live_...) |
| `AGENTLEDGER_URL` | AgentLedger app URL (default: https://agentledger.io) |
| `AGENTLEDGER_INGEST_URL` | Ingest service URL (default: https://ingest.agentledger.io) |

## Available tools

### `get_authorization`
Get the active authorization record for an agent wallet. Shows permitted actions, limits, and whitelisted programs.

### `list_agents`
List all registered agent wallets with authorization status and open findings count.

### `start_audit_session`
Begin an audit session for an agent wallet. Required before logging reasoning or actions.

### `log_reasoning`
Log the agent's stated intent before taking an action. Captures the "why" for the audit trail.

### `log_action`
Log an action taken — tool call, transaction submission, or error.

### `end_audit_session`
Close the session. Computes Merkle root over all events and anchors to Solana.

### `check_authorization`
Pre-flight check: is this proposed action within the agent's authorization scope? Returns ALLOWED or BLOCKED with reason.

### `get_findings`
Get open policy findings — authorization violations, limit breaches, reasoning inconsistencies.

### `verify_anchor`
Verify an on-chain anchor transaction. Confirms a record is authentic and unmodified.

### `generate_report`
Generate an audit compliance PDF report. Supports FULL_AUDIT_PACKAGE, TAX_POSITION, COMPLIANCE_ONLY, and FINDINGS_SUMMARY.

## Example usage in an agent

```typescript
// Before taking a risky action, check authorization
const check = await mcp.callTool("check_authorization", {
  orgId: "org_123",
  agentId: "agent_456",
  txType: "swap",
  programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  amountUsd: 250,
});
// Returns: "ALLOWED — Within authorization scope (v3)"

// Log reasoning before acting
await mcp.callTool("log_reasoning", {
  summary: "Rebalancing yield: swapping 250 USDC to SOL — Blueprint APY exceeds Orca LP by 1.8%"
});

// Log the action after
await mcp.callTool("log_action", {
  toolName: "jupiter_swap",
  txSignature: "5Tz3UePC...",
  amountUsd: 250,
});
```
