import { sendFindingsAlert } from "./email";
/**
 * AgentLedger — Policy Engine
 *
 * Claude-powered compliance analysis that runs on a schedule (nightly)
 * or on-demand. Compares agent transaction history against authorization
 * records and generates structured policy findings.
 *
 * Uses Anthropic Batch API for cost efficiency (50% cheaper than standard,
 * processes within 24 hours — ideal for compliance workloads).
 *
 * Findings map to:
 *   - EXCEEDED_TX_LIMIT: transaction exceeded max_tx_value_usd
 *   - EXCEEDED_DAILY_LIMIT: daily spend exceeded max_daily_spend_usd
 *   - UNAUTHORIZED_PROGRAM: tx invoked a program not in whitelist
 *   - ANOMALOUS_FREQUENCY: unusual transaction frequency vs baseline
 *   - NO_ACTIVE_AUTHORIZATION: agent transacted without a valid auth record
 *   - REASONING_MISMATCH: stated reasoning inconsistent with action taken
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import type { AgentWallet, AuthorizationRecord, AuditLogEntry } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface FindingInput {
  agentWalletId: string;
  authorizationId: string | null;
  findingType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  description: string;
  txSignature?: string;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run policy scan for a single org.
 * Called nightly by a scheduled job, or on-demand from the API.
 */
export async function runPolicyScan(orgId: string): Promise<{
  agentsScanned: number;
  findingsCreated: number;
}> {
  console.log(`[policy] Starting scan for org ${orgId}`);

  const agents = await prisma.agentWallet.findMany({
    where: { orgId, status: { not: "ARCHIVED" } },
    include: {
      authorizationRecords: {
        where: { effectiveTo: null, revokedAt: null },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  let totalFindings = 0;

  for (const agent of agents) {
    const findings = await scanAgent(agent);
    if (findings.length > 0) {
      await createFindings(findings);
      totalFindings += findings.length;
    }
  }

  console.log(`[policy] Scan complete — ${agents.length} agents, ${totalFindings} new findings`);

  // Email org owners if new critical or high findings were found
  if (totalFindings > 0) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { members: { where: { role: { in: ["OWNER", "ADMIN"] } }, include: { user: { select: { email: true } } } } },
    });
    const newFindings = await prisma.policyFinding.findMany({
      where: { agentWallet: { orgId }, severity: { in: ["CRITICAL", "HIGH"] }, status: "OPEN", detectedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
      include: { agentWallet: { select: { agentName: true } } },
      take: 10,
    });
    if (org && newFindings.length > 0) {
      const emails = org.members.map((m) => m.user.email).filter(Boolean) as string[];
      const critical = newFindings.filter((f) => f.severity === "CRITICAL").length;
      const high     = newFindings.filter((f) => f.severity === "HIGH").length;
      for (const email of emails) {
        sendFindingsAlert({
          to: email, orgName: org.name, criticalCount: critical, highCount: high,
          findings: newFindings.map((f) => ({ title: f.title, agentName: f.agentWallet.agentName, severity: f.severity })),
        }).catch(console.error);
      }
    }
  }

  return { agentsScanned: agents.length, findingsCreated: totalFindings };
}

// ─── Per-agent scan ───────────────────────────────────────────────────────────

async function scanAgent(
  agent: AgentWallet & { authorizationRecords: AuthorizationRecord[] }
): Promise<FindingInput[]> {
  const findings: FindingInput[] = [];
  const activeAuth = agent.authorizationRecords[0] ?? null;

  // Get recent transactions (last 24 hours)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = await prisma.auditLogEntry.findMany({
    where: {
      agentWalletId: agent.id,
      createdAt: { gte: since },
      eventType: { in: ["TX_SUBMIT", "TX_CONFIRM", "TOOL_CALL"] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (recentLogs.length === 0) return [];

  // ── Rule-based checks (fast, no LLM needed) ──────────────────────────────

  // 1. No active authorization
  if (!activeAuth) {
    const txLogs = recentLogs.filter((l) => l.txSignature);
    if (txLogs.length > 0) {
      findings.push({
        agentWalletId: agent.id,
        authorizationId: null,
        findingType: "NO_ACTIVE_AUTHORIZATION",
        severity: "CRITICAL",
        title: "Agent transacted without active authorization",
        description:
          `Agent ${agent.agentName} (${agent.walletAddress.slice(0, 8)}…) executed ` +
          `${txLogs.length} transaction${txLogs.length > 1 ? "s" : ""} in the last 24 hours ` +
          `without an active authorization record. All agent activity must operate under ` +
          `a signed and documented authorization scope.`,
        txSignature: txLogs[0].txSignature ?? undefined,
      });
    }
    return findings; // No auth = no further checks
  }

  // 2. Transaction value limit
  if (activeAuth.maxTxValueUsd !== null) {
    const limit = Number(activeAuth.maxTxValueUsd);
    for (const log of recentLogs) {
      if (log.amountUsd && Number(log.amountUsd) > limit) {
        findings.push({
          agentWalletId: agent.id,
          authorizationId: activeAuth.id,
          findingType: "EXCEEDED_TX_LIMIT",
          severity: "HIGH",
          title: "Transaction exceeded authorized limit",
          description:
            `Transaction of $${Number(log.amountUsd).toFixed(2)} USD exceeded the authorized ` +
            `per-transaction limit of $${limit.toFixed(2)} USD for agent ${agent.agentName}. ` +
            `Authorization record v${activeAuth.version} must be updated to permit transactions ` +
            `of this size, or the agent's operational scope needs review.`,
          txSignature: log.txSignature ?? undefined,
        });
      }
    }
  }

  // 3. Daily spend limit
  if (activeAuth.maxDailySpendUsd !== null) {
    const limit = Number(activeAuth.maxDailySpendUsd);
    const totalSpend = recentLogs.reduce((sum, l) => sum + (Number(l.amountUsd) || 0), 0);
    if (totalSpend > limit) {
      findings.push({
        agentWalletId: agent.id,
        authorizationId: activeAuth.id,
        findingType: "EXCEEDED_DAILY_LIMIT",
        severity: "HIGH",
        title: "Daily spend limit exceeded",
        description:
          `Agent ${agent.agentName} spent $${totalSpend.toFixed(2)} USD in the last 24 hours, ` +
          `exceeding the authorized daily limit of $${limit.toFixed(2)} USD. ` +
          `Review activity for unauthorized operations.`,
      });
    }
  }

  // 4. Unauthorized program
  if (activeAuth.whitelistedPrograms.length > 0) {
    const unauthorized = recentLogs.filter(
      (l) =>
        l.onChainProgram &&
        !activeAuth.whitelistedPrograms.includes(l.onChainProgram)
    );
    for (const log of unauthorized) {
      findings.push({
        agentWalletId: agent.id,
        authorizationId: activeAuth.id,
        findingType: "UNAUTHORIZED_PROGRAM",
        severity: "HIGH",
        title: "Interaction with unauthorized Solana program",
        description:
          `Agent ${agent.agentName} invoked program ${log.onChainProgram} which is not ` +
          `in the whitelisted program list for authorization v${activeAuth.version}. ` +
          `Whitelisted programs: [${activeAuth.whitelistedPrograms.join(", ")}].`,
        txSignature: log.txSignature ?? undefined,
      });
    }
  }

  // ── LLM-based check: reasoning consistency ────────────────────────────────

  // Only run Claude check on sessions that have reasoning logs
  const reasoningLogs = recentLogs.filter((l) => l.eventType === "REASONING" && l.reasoningSummary);
  const txLogs = recentLogs.filter((l) => l.txSignature && l.toolName);

  if (reasoningLogs.length > 0 && txLogs.length > 0) {
    const llmFindings = await checkReasoningConsistency(
      agent,
      activeAuth,
      reasoningLogs,
      txLogs
    );
    findings.push(...llmFindings);
  }

  // ── Anomaly: frequency spike ──────────────────────────────────────────────

  // Simple heuristic: if >50 tx in 24h, flag for review
  const txCount = recentLogs.filter((l) => l.txSignature).length;
  if (txCount > 50) {
    findings.push({
      agentWalletId: agent.id,
      authorizationId: activeAuth.id,
      findingType: "ANOMALOUS_FREQUENCY",
      severity: "MEDIUM",
      title: "Unusually high transaction frequency",
      description:
        `Agent ${agent.agentName} executed ${txCount} transactions in the last 24 hours. ` +
        `This is above the threshold for automated review (50/day). ` +
        `Verify this activity aligns with the agent's operational purpose: "${activeAuth.operationalPurpose}".`,
    });
  }

  // Deduplicate — don't re-create findings that already exist for the same tx
  const existingTxSigs = new Set(
    (
      await prisma.policyFinding.findMany({
        where: {
          agentWalletId: agent.id,
          txSignature: { not: null },
          status: { not: "REMEDIATED" },
        },
        select: { txSignature: true },
      })
    ).map((f) => f.txSignature)
  );

  return findings.filter((f) => !f.txSignature || !existingTxSigs.has(f.txSignature));
}

// ─── Claude: reasoning consistency check ─────────────────────────────────────

async function checkReasoningConsistency(
  agent: AgentWallet,
  auth: AuthorizationRecord,
  reasoningLogs: AuditLogEntry[],
  txLogs: AuditLogEntry[]
): Promise<FindingInput[]> {
  const reasoningText = reasoningLogs
    .map((l) => `- ${l.reasoningSummary}`)
    .join("\n");

  const actionText = txLogs
    .map((l) => `- Tool: ${l.toolName}, Program: ${l.onChainProgram ?? "unknown"}, Amount: $${l.amountUsd ?? "?"}`)
    .join("\n");

  const prompt = `You are a compliance analyst reviewing AI agent activity on the Solana blockchain.

Agent: ${agent.agentName}
Authorization scope: "${auth.operationalPurpose}"
Permitted transaction types: ${auth.permittedTxTypes.join(", ")}

Agent reasoning statements (what the agent said it was doing):
${reasoningText}

Agent actions taken (actual transactions):
${actionText}

Analyze whether the agent's actions are consistent with:
1. Its stated reasoning
2. Its documented authorization scope

Respond ONLY with valid JSON in this exact format:
{
  "consistent": true/false,
  "concerns": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "description": "Specific concern about inconsistency"
    }
  ]
}

If consistent, return: {"consistent": true, "concerns": []}
Be conservative — only flag genuine inconsistencies, not minor variations in wording.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
      consistent: boolean;
      concerns: { severity: string; description: string }[];
    };

    if (result.consistent || result.concerns.length === 0) return [];

    return result.concerns.map((c) => ({
      agentWalletId: agent.id,
      authorizationId: auth.id,
      findingType: "REASONING_MISMATCH",
      severity: c.severity as "HIGH" | "MEDIUM" | "LOW",
      title: "Agent reasoning inconsistent with action taken",
      description: c.description,
    }));
  } catch (err) {
    console.error("[policy] LLM reasoning check failed:", err);
    return [];
  }
}

// ─── Persist findings ─────────────────────────────────────────────────────────

async function createFindings(findings: FindingInput[]) {
  await prisma.policyFinding.createMany({
    data: findings.map((f) => ({
      agentWalletId: f.agentWalletId,
      authorizationId: f.authorizationId,
      findingType: f.findingType as any,
      severity: f.severity as any,
      title: f.title,
      description: f.description,
      txSignature: f.txSignature,
      status: "OPEN",
      detectedAt: new Date(),
    })),
    skipDuplicates: false,
  });
}
