#!/usr/bin/env node
/**
 * @agentledger/mcp — MCP Server
 *
 * Exposes AgentLedger as an MCP tool set.
 * Agents can call AgentLedger directly without installing the SDK.
 *
 * Install in Claude Code:
 *   npx skills add agentledger/mcp
 *
 * Or add to Claude Code settings:
 *   {
 *     "mcpServers": {
 *       "agentledger": {
 *         "command": "npx",
 *         "args": ["-y", "@agentledger/mcp"],
 *         "env": {
 *           "AGENTLEDGER_KEY": "al_live_...",
 *           "AGENTLEDGER_URL": "https://agentledger.io"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.AGENTLEDGER_KEY;
const BASE    = process.env.AGENTLEDGER_URL ?? "https://agentledger.io";
const INGEST  = process.env.AGENTLEDGER_INGEST_URL ?? "https://ingest.agentledger.io";

if (!API_KEY) {
  console.error("AGENTLEDGER_KEY environment variable required");
  process.exit(1);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AgentLedger API ${res.status}: ${text}`);
  }
  return res.json();
}

async function ingest(path: string, body: unknown, walletAddress?: string) {
  const res = await fetch(`${INGEST}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      ...(walletAddress ? { "x-agentledger-wallet": walletAddress } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ingest API ${res.status}: ${text}`);
  }
  return res.json();
}

// Session state (in-memory for the current MCP session)
let currentSession: { sessionId: string; walletAddress: string } | null = null;

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "agentledger", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_authorization",
      description:
        "Get the active authorization record for an agent wallet. Shows what the agent is permitted to do, transaction limits, and whitelisted programs.",
      inputSchema: {
        type: "object",
        properties: {
          orgId:         { type: "string", description: "Organization ID" },
          agentId:       { type: "string", description: "Agent wallet ID (from AgentLedger dashboard)" },
        },
        required: ["orgId", "agentId"],
      },
    },
    {
      name: "list_agents",
      description: "List all registered agent wallets for an organization, including their authorization status and open findings.",
      inputSchema: {
        type: "object",
        properties: {
          orgId: { type: "string", description: "Organization ID" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "start_audit_session",
      description:
        "Start a new audit session for an agent wallet. Call this when an agent begins a task. Returns a sessionId for subsequent log_reasoning and log_action calls.",
      inputSchema: {
        type: "object",
        properties: {
          walletAddress: { type: "string", description: "Solana wallet address of the agent" },
        },
        required: ["walletAddress"],
      },
    },
    {
      name: "log_reasoning",
      description:
        "Log the agent's stated reasoning before taking an action. Call this before every significant action to create an audit trail of the agent's intent.",
      inputSchema: {
        type: "object",
        properties: {
          summary:      { type: "string", description: "What the agent intends to do and why" },
          contextHash:  { type: "string", description: "SHA-256 hash of the full prompt context (optional)" },
        },
        required: ["summary"],
      },
    },
    {
      name: "log_action",
      description:
        "Log an action taken by the agent. Call this after executing a tool or transaction.",
      inputSchema: {
        type: "object",
        properties: {
          toolName:        { type: "string", description: "Name of the tool or function called" },
          txSignature:     { type: "string", description: "Solana transaction signature (if on-chain)" },
          onChainProgram:  { type: "string", description: "Solana program ID invoked (if applicable)" },
          amountUsd:       { type: "number", description: "USD value of the transaction" },
        },
        required: ["toolName"],
      },
    },
    {
      name: "end_audit_session",
      description:
        "End the current audit session. Computes a Merkle root over all logged events and triggers on-chain anchoring to Solana.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_findings",
      description: "Get open policy findings for an organization. Returns violations of authorization scope, limit breaches, and reasoning inconsistencies.",
      inputSchema: {
        type: "object",
        properties: {
          orgId:    { type: "string", description: "Organization ID" },
          severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"], description: "Filter by severity" },
        },
        required: ["orgId"],
      },
    },
    {
      name: "check_authorization",
      description:
        "Check whether a proposed action is within the agent's active authorization scope. Returns allowed/blocked with the reason.",
      inputSchema: {
        type: "object",
        properties: {
          orgId:           { type: "string", description: "Organization ID" },
          agentId:         { type: "string", description: "Agent wallet ID" },
          txType:          { type: "string", description: "Transaction type (swap, stake, transfer, etc.)" },
          programId:       { type: "string", description: "Solana program ID to be invoked (optional)" },
          amountUsd:       { type: "number", description: "USD value of the proposed transaction (optional)" },
        },
        required: ["orgId", "agentId", "txType"],
      },
    },
    {
      name: "verify_anchor",
      description: "Verify an AgentLedger on-chain anchor transaction. Checks if the memo hash matches the database record.",
      inputSchema: {
        type: "object",
        properties: {
          txSignature: { type: "string", description: "Solana transaction signature of the anchor tx" },
        },
        required: ["txSignature"],
      },
    },
    {
      name: "generate_report",
      description: "Generate an audit compliance report PDF. Returns a job ID to check status and download.",
      inputSchema: {
        type: "object",
        properties: {
          orgId:        { type: "string", description: "Organization ID" },
          reportType:   { type: "string", enum: ["FULL_AUDIT_PACKAGE", "COMPLIANCE_ONLY", "TAX_POSITION", "FINDINGS_SUMMARY"], description: "Type of report" },
          reportFormat: { type: "string", enum: ["STANDARD", "FEDERAL", "CPA"], description: "Output format — FEDERAL for CMMC, CPA for tax" },
          periodStart:  { type: "string", description: "Start date (ISO 8601)" },
          periodEnd:    { type: "string", description: "End date (ISO 8601)" },
        },
        required: ["orgId", "periodStart", "periodEnd"],
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      case "get_authorization": {
        const { orgId, agentId } = args as { orgId: string; agentId: string };
        const data = await api(`/api/orgs/${orgId}/agents/${agentId}/authorizations`);
        const active = data.records?.find((r: any) => !r.effectiveTo);
        if (!active) {
          return result(`No active authorization for agent ${agentId}. Create one in the AgentLedger dashboard.`);
        }
        return result(JSON.stringify({
          version:            active.version,
          purpose:            active.operationalPurpose,
          maxTxValueUsd:      active.maxTxValueUsd,
          maxDailySpendUsd:   active.maxDailySpendUsd,
          permittedTxTypes:   active.permittedTxTypes,
          whitelistedPrograms: active.whitelistedPrograms,
          effectiveFrom:      active.effectiveFrom,
          anchored:           !!active.onChainAnchorTx,
          anchorTx:           active.onChainAnchorTx,
        }, null, 2));
      }

      case "list_agents": {
        const { orgId } = args as { orgId: string };
        const data = await api(`/api/orgs/${orgId}/agents`);
        const summary = (data.agents ?? []).map((a: any) => ({
          id:            a.id,
          name:          a.agentName,
          wallet:        a.walletAddress,
          framework:     a.framework,
          status:        a.status,
          authVersion:   a.authorizationRecords?.[0]?.version ?? "none",
          openFindings:  a._count?.policyFindings ?? 0,
        }));
        return result(JSON.stringify(summary, null, 2));
      }

      case "start_audit_session": {
        const { walletAddress } = args as { walletAddress: string };
        const data = await ingest("/session/start", { startedAt: new Date().toISOString() }, walletAddress);
        currentSession = { sessionId: data.sessionId, walletAddress };
        return result(`Audit session started. Session ID: ${data.sessionId}`);
      }

      case "log_reasoning": {
        if (!currentSession) {
          return result("No active session. Call start_audit_session first.", true);
        }
        await ingest(
          "/session/events",
          {
            sessionId: currentSession.sessionId,
            events: [{
              eventType:        "REASONING",
              sequenceNum:      Date.now(),
              reasoningSummary: (args as any).summary,
              promptContextHash: (args as any).contextHash,
              createdAt:        new Date().toISOString(),
            }],
          },
          currentSession.walletAddress
        );
        return result("Reasoning logged to audit trail.");
      }

      case "log_action": {
        if (!currentSession) {
          return result("No active session. Call start_audit_session first.", true);
        }
        const a = args as any;
        await ingest(
          "/session/events",
          {
            sessionId: currentSession.sessionId,
            events: [{
              eventType:       a.txSignature ? "TX_SUBMIT" : "TOOL_CALL",
              sequenceNum:     Date.now(),
              toolName:        a.toolName,
              txSignature:     a.txSignature,
              onChainProgram:  a.onChainProgram,
              amountUsd:       a.amountUsd,
              createdAt:       new Date().toISOString(),
            }],
          },
          currentSession.walletAddress
        );
        return result(`Action logged: ${a.toolName}${a.txSignature ? ` (tx: ${a.txSignature.slice(0,12)}…)` : ""}`);
      }

      case "end_audit_session": {
        if (!currentSession) return result("No active session.");
        const data = await ingest("/session/end", {
          sessionId: currentSession.sessionId,
          endedAt:   new Date().toISOString(),
        }, currentSession.walletAddress);
        const session = currentSession;
        currentSession = null;
        return result(
          `Session closed. ${data.logCount} events logged.\n` +
          `Merkle root: ${data.merkleRoot}\n` +
          `On-chain anchoring: ${data.status === "ANCHORED" ? "complete" : "in progress"}`
        );
      }

      case "get_findings": {
        const a    = args as any;
        const qs   = a.severity ? `?severity=${a.severity}` : "?status=OPEN";
        const data = await api(`/api/orgs/${a.orgId}/findings${qs}`);
        const findings = (data.findings ?? []).map((f: any) => ({
          severity:    f.severity,
          title:       f.title,
          agent:       f.agentWallet?.agentName,
          status:      f.status,
          detectedAt:  f.detectedAt,
        }));
        if (findings.length === 0) return result("No open findings. All agents operating within authorization scope.");
        return result(JSON.stringify(findings, null, 2));
      }

      case "check_authorization": {
        const a    = args as any;
        const data = await api(`/api/orgs/${a.orgId}/agents/${a.agentId}/authorizations`);
        const auth = data.records?.find((r: any) => !r.effectiveTo);

        if (!auth) return result("BLOCKED — No active authorization record for this agent.");

        const checks: string[] = [];
        let blocked = false;

        if (!auth.permittedTxTypes.includes(a.txType)) {
          checks.push(`BLOCKED: tx type "${a.txType}" not in permitted types [${auth.permittedTxTypes.join(", ")}]`);
          blocked = true;
        }
        if (a.programId && auth.whitelistedPrograms.length > 0 && !auth.whitelistedPrograms.includes(a.programId)) {
          checks.push(`BLOCKED: program ${a.programId} not in whitelist`);
          blocked = true;
        }
        if (a.amountUsd && auth.maxTxValueUsd && a.amountUsd > Number(auth.maxTxValueUsd)) {
          checks.push(`BLOCKED: $${a.amountUsd} exceeds max tx value of $${auth.maxTxValueUsd}`);
          blocked = true;
        }

        if (blocked) return result(checks.join("\n"));
        return result(`ALLOWED — Within authorization scope (v${auth.version})\nPurpose: ${auth.operationalPurpose}`);
      }

      case "verify_anchor": {
        const { txSignature } = args as { txSignature: string };
        const data = await fetch(`${BASE}/api/verify-anchor?tx=${txSignature}`).then(r => r.json());
        return result(JSON.stringify(data, null, 2));
      }

      case "generate_report": {
        const a    = args as any;
        const data = await api(`/api/orgs/${a.orgId}/reports`, {
          method: "POST",
          body: JSON.stringify({
            reportType:   a.reportType   ?? "FULL_AUDIT_PACKAGE",
            reportFormat: a.reportFormat ?? "STANDARD",
            periodStart:  a.periodStart,
            periodEnd:    a.periodEnd,
          }),
        });
        return result(
          `Report generation started. ID: ${data.report.id}\n` +
          `Check status: GET ${BASE}/api/orgs/${a.orgId}/reports/${data.report.id}\n` +
          `Usually ready in 30–60 seconds.`
        );
      }

      default:
        return result(`Unknown tool: ${name}`, true);
    }
  } catch (err: any) {
    return result(`Error: ${err.message}`, true);
  }
});

function result(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[agentledger-mcp] Running on stdio");
