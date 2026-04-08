/**
 * @agentledger/sdk
 *
 * Compliance audit trail SDK for Solana AI agent operators.
 * Captures the reasoning-to-transaction chain and streams it to
 * AgentLedger for compliance reporting and on-chain Merkle anchoring.
 *
 * Usage (Solana Agent Kit):
 *   const ledger = new AgentLedger({ apiKey: 'al_live_...', agentWalletAddress: '...' });
 *   await ledger.executeWithAudit('Swapping 10 USDC to SOL for yield rebalancing', async () => {
 *     return agent.swap({ inputMint: USDC, outputMint: SOL, amount: 10 });
 *   });
 *
 * Usage (ElizaOS plugin):
 *   import { agentLedgerPlugin } from '@agentledger/sdk/elizaos';
 *   // Add to character.json plugins array
 */

import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentLedgerConfig {
  /** API key from AgentLedger dashboard. Starts with al_live_ or al_test_ */
  apiKey: string;
  /** Solana wallet address (pubkey) of the agent being audited */
  agentWalletAddress: string;
  /** Agent runtime framework for context tagging */
  framework?: "elizaos" | "solana-agent-kit" | "goat" | "custom";
  /** AgentLedger ingest API URL. Default: https://ingest.agentledger.io */
  ingestUrl?: string;
  /** Events to batch before flushing. Default: 20 */
  batchSize?: number;
  /** Max ms to wait before flushing a partial batch. Default: 5000 */
  flushInterval?: number;
  /** Enable verbose console logging. Default: false */
  debug?: boolean;
}

export interface LogReasoningParams {
  /** The agent's stated intent before taking action. Required. */
  summary: string;
  /**
   * SHA-256 hash of the full prompt context window.
   * The raw prompt is never sent — only the hash for audit trail integrity.
   * Use: crypto.createHash('sha256').update(promptString).digest('hex')
   */
  contextHash?: string;
}

export interface LogActionParams {
  /** ID returned from logReasoning() that this action follows from */
  reasoningEventId: string;
  /** Name of the tool/function called */
  toolName: string;
  /**
   * SHA-256 hash of the tool parameters.
   * Full params are never sent — only the hash.
   */
  toolParamsHash?: string;
  /** Solana transaction signature if this action produced an on-chain tx */
  txSignature?: string;
  /** Solana program ID that was invoked */
  onChainProgram?: string;
  /** USD value of the transaction at execution time */
  amountUsd?: number;
}

export interface LogErrorParams {
  reasoningEventId: string;
  error: Error | string;
}

export type AuditEventType =
  | "REASONING"
  | "TOOL_CALL"
  | "TX_SUBMIT"
  | "TX_CONFIRM"
  | "TX_FAILED"
  | "ERROR"
  | "SESSION_START"
  | "SESSION_END";

interface QueuedEvent {
  eventType: AuditEventType;
  sequenceNum: number;
  reasoningSummary?: string;
  promptContextHash?: string;
  toolName?: string;
  toolParamsHash?: string;
  txSignature?: string;
  onChainProgram?: string;
  amountUsd?: number;
  createdAt: string;
}

// ─── Main class ───────────────────────────────────────────────────────────────

export class AgentLedger {
  private config: Required<AgentLedgerConfig>;
  private sessionId: string | null = null;
  private sequenceNum = 0;
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private started = false;

  constructor(config: AgentLedgerConfig) {
    this.config = {
      framework: "custom",
      ingestUrl: "https://ingest.agentledger.io",
      batchSize: 20,
      flushInterval: 5000,
      debug: false,
      ...config,
    };
  }

  // ─── Session lifecycle ──────────────────────────────────────────────────────

  async startSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;

    const res = await this.post("/session/start", {
      agentWalletAddress: this.config.agentWalletAddress,
      framework: this.config.framework,
      startedAt: new Date().toISOString(),
    });

    this.sessionId = res.sessionId;
    this.sequenceNum = 0;
    this.started = true;

    this.log(`Session started: ${this.sessionId}`);
    this.scheduleFlush();
    return this.sessionId!;
  }

  async endSession(): Promise<{ merkleRoot: string; onChainAnchorTx?: string }> {
    if (!this.sessionId) throw new Error("No active session");

    // Flush any remaining queued events
    await this.flushNow();

    const res = await this.post("/session/end", {
      sessionId: this.sessionId,
      endedAt: new Date().toISOString(),
    });

    this.log(`Session ended: ${this.sessionId} | root: ${res.merkleRoot}`);
    this.sessionId = null;
    this.sequenceNum = 0;
    return res;
  }

  // ─── Event logging ──────────────────────────────────────────────────────────

  async logReasoning(params: LogReasoningParams): Promise<string> {
    if (!this.sessionId) await this.startSession();

    const eventId = this.generateEventId();
    this.enqueue({
      eventType: "REASONING",
      reasoningSummary: params.summary,
      promptContextHash: params.contextHash,
    });

    return eventId;
  }

  async logAction(params: LogActionParams): Promise<void> {
    if (!this.sessionId) await this.startSession();

    this.enqueue({
      eventType: params.txSignature ? "TX_SUBMIT" : "TOOL_CALL",
      toolName: params.toolName,
      toolParamsHash: params.toolParamsHash,
      txSignature: params.txSignature,
      onChainProgram: params.onChainProgram,
      amountUsd: params.amountUsd,
    });
  }

  async logTxConfirmed(txSignature: string, amountUsd?: number): Promise<void> {
    this.enqueue({ eventType: "TX_CONFIRM", txSignature, amountUsd });
  }

  async logError(params: LogErrorParams): Promise<void> {
    const msg = params.error instanceof Error ? params.error.message : params.error;
    this.enqueue({ eventType: "ERROR", reasoningSummary: msg });
  }

  // ─── High-level wrapper ─────────────────────────────────────────────────────

  /**
   * Wraps your agent's action execution with full audit trail capture.
   * The most common integration pattern — replaces your existing action calls.
   *
   * @example
   * const result = await ledger.executeWithAudit(
   *   'Rebalancing portfolio: swap USDC to SOL for staking yield',
   *   async () => agentKit.swap({ inputMint: USDC_MINT, outputMint: SOL_MINT, amount: 100 })
   * );
   */
  async executeWithAudit<T>(
    reasoning: string,
    action: () => Promise<T>,
    options?: {
      toolName?: string;
      contextHash?: string;
    }
  ): Promise<T> {
    const eventId = await this.logReasoning({
      summary: reasoning,
      contextHash: options?.contextHash,
    });

    try {
      const result = await action();

      // Extract tx info from common SAK/ElizaOS result shapes
      const txSig = extractTxSignature(result);
      const program = extractProgram(result);
      const amount = extractAmount(result);

      await this.logAction({
        reasoningEventId: eventId,
        toolName: options?.toolName ?? "unknown",
        txSignature: txSig,
        onChainProgram: program,
        amountUsd: amount,
      });

      return result;
    } catch (err) {
      await this.logError({ reasoningEventId: eventId, error: err as Error });
      throw err;
    }
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private enqueue(event: Omit<QueuedEvent, "sequenceNum" | "createdAt">) {
    this.queue.push({
      ...event,
      sequenceNum: ++this.sequenceNum,
      createdAt: new Date().toISOString(),
    });

    if (this.queue.length >= this.config.batchSize) {
      this.flushNow();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushNow();
      if (this.sessionId) this.scheduleFlush();
    }, this.config.flushInterval);
  }

  private async flushNow(): Promise<void> {
    if (this.flushing || this.queue.length === 0 || !this.sessionId) return;
    this.flushing = true;

    const batch = this.queue.splice(0, this.config.batchSize);

    try {
      await this.post("/session/events", {
        sessionId: this.sessionId,
        events: batch,
      });
      this.log(`Flushed ${batch.length} events`);
    } catch (err) {
      // Re-queue on failure — retry on next flush
      this.queue.unshift(...batch);
      this.log(`Flush failed, re-queued ${batch.length} events: ${err}`);
    } finally {
      this.flushing = false;
    }
  }

  private generateEventId(): string {
    return `evt_${crypto.randomBytes(8).toString("hex")}`;
  }

  private async post(path: string, body: unknown): Promise<any> {
    const url = `${this.config.ingestUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        "X-AgentLedger-Wallet": this.config.agentWalletAddress,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AgentLedger API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  private log(msg: string) {
    if (this.config.debug) {
      console.log(`[AgentLedger] ${msg}`);
    }
  }
}

// ─── ElizaOS plugin ────────────────────────────────────────────────────────────

/**
 * ElizaOS plugin — drop into your character.json plugins array.
 * Automatically wraps all agent actions with audit trail capture.
 */
export function createElizaOSPlugin(config: AgentLedgerConfig) {
  const ledger = new AgentLedger({ ...config, framework: "elizaos" });

  return {
    name: "agentledger",
    description: "Compliance audit trail — captures reasoning-to-transaction chains",

    // ElizaOS evaluator hook — runs after each action
    evaluators: [
      {
        name: "agentledger-audit",
        description: "Captures agent actions for compliance audit trail",
        validate: async (_runtime: any, _message: any) => true,
        handler: async (_runtime: any, message: any, _state: any, options: any) => {
          const reasoning = message?.content?.text ?? "No reasoning captured";
          const action = options?.action;

          await ledger.logReasoning({ summary: reasoning });

          if (action?.txSignature) {
            await ledger.logAction({
              reasoningEventId: "latest",
              toolName: action.name ?? "unknown",
              txSignature: action.txSignature,
              onChainProgram: action.program,
              amountUsd: action.amountUsd,
            });
          }
        },
      },
    ],

    // Cleanup on process exit
    onShutdown: async () => {
      await ledger.endSession();
    },
  };
}

// ─── Helper — extract tx info from common result shapes ──────────────────────

function extractTxSignature(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, any>;
  return r.txSignature ?? r.signature ?? r.txSig ?? r.transactionSignature ?? undefined;
}

function extractProgram(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, any>;
  return r.programId ?? r.program ?? r.onChainProgram ?? undefined;
}

function extractAmount(result: unknown): number | undefined {
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, any>;
  const raw = r.amountUsd ?? r.valueUsd ?? r.usdValue;
  return raw != null ? Number(raw) : undefined;
}

// ─── Utility: hash a prompt context window ────────────────────────────────────

export function hashContext(promptText: string): string {
  return crypto.createHash("sha256").update(promptText).digest("hex");
}

export function hashParams(params: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(params))
    .digest("hex");
}
