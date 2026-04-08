/**
 * AgentLedger — Email Sequence Templates
 *
 * Actual email content for each sequence step.
 * Claude generates personalized variants at send time — these are the
 * structural prompts and fallback copy if generation fails.
 */

export interface SequenceStep {
  delayDays: number;
  subject: string;
  body: string;
  segment: "federal" | "solana" | "enterprise";
}

// ─── New User Onboarding (triggered on signup) ────────────────────────────────

export const ONBOARDING_SEQUENCE: SequenceStep[] = [
  {
    delayDays: 0,
    subject: "Your AgentLedger account is ready",
    body: `Hi {{firstName}},

Your AgentLedger account is set up. Here's the fastest path to your first audit record:

1. Register an agent wallet (Dashboard → Agents → Register)
2. Create an authorization record — takes 2 minutes with our templates
3. Install the SDK: npm install @agentledger/sdk

The SDK drops into any ElizaOS, Solana Agent Kit, or GOAT runtime in about 6 lines:

  const ledger = new AgentLedger({
    apiKey: '{{apiKey}}',
    agentWalletAddress: process.env.WALLET,
  });

  await ledger.executeWithAudit(
    'What the agent is doing and why',
    () => agentKit.doSomething()
  );

If you're running agents on Solana and need audit-grade documentation for a CFO, auditor, or CMMC assessor — that's what we built this for.

Any questions, reply here.

Kevin
AgentLedger`,
    segment: "enterprise",
  },
  {
    delayDays: 3,
    subject: "One thing most teams miss before deploying agents",
    body: `Hi {{firstName}},

Quick follow-up.

Most teams deploying AI agents on Solana focus on what the agent can do. The thing that comes up later — usually from legal, finance, or an auditor — is whether the agent was *authorized* to do what it did.

Authorization records in AgentLedger answer that directly. You define the scope (permitted transaction types, spending limits, whitelisted programs), sign it, and it gets anchored on-chain. When someone asks later, you have a timestamped, tamper-proof answer.

It takes about 5 minutes to create your first one. There are 8 templates to start from if you don't want to write from scratch.

→ Dashboard → Agents → your wallet → New authorization

Kevin`,
    segment: "enterprise",
  },
  {
    delayDays: 7,
    subject: "What an AgentLedger audit package looks like",
    body: `Hi {{firstName}},

When you're ready to show an auditor, CFO, or CMMC assessor that your agents operated within policy — this is what you hand them:

A 4-page PDF:
- Cover page with period, agent count, finding summary
- Authorization records with on-chain verification links
- Policy findings (open + disposed)
- Attestation signature block

You can generate one now from Dashboard → Reports → Generate.

The Federal format uses NIST SP 800-53 language throughout, which is what defense contractor auditors expect. The Standard and CPA formats target enterprise and tax practitioners respectively.

If you're already using the SDK to capture audit sessions, those Merkle-anchored session logs also appear in the package.

Kevin`,
    segment: "enterprise",
  },
  {
    delayDays: 14,
    subject: "Are you deploying agents in a regulated environment?",
    body: `Hi {{firstName}},

Checking in. A quick question:

Are you deploying agents in a context where you need to demonstrate governance — federal contracting, financial services, healthcare, or an enterprise with a formal audit function?

If so, the Enterprise plan ($999/mo) adds CMMC-formatted output, unlimited wallets, and unlimited retention — the features that matter most when you're producing evidence for an external auditor.

If you're earlier stage or building for yourself, the Starter plan at $49/mo covers everything you need to get started.

Either way, happy to answer questions. Just reply.

Kevin`,
    segment: "enterprise",
  },
];

// ─── Federal contractor outreach (3 steps) ────────────────────────────────────

export const FEDERAL_SEQUENCE: SequenceStep[] = [
  {
    delayDays: 0,
    subject: "CMMC and autonomous AI agents — a gap most assessors are starting to flag",
    body: `Hi {{firstName}},

I work on compliance for defense subcontractors, and over the last six months I've started seeing a new category of question in CMMC assessments: how do you govern your autonomous AI agents?

If your team is using AI systems that make decisions and take actions autonomously — whether that's processing contracts, managing compute resources, or interacting with external services — CMMC assessors are beginning to ask for documented controls around those systems.

NIST SP 800-53 AC-2 covers automated account management, and agents that transact autonomously fall squarely in scope.

I built AgentLedger (agentledger.io) specifically to produce the documentation these assessors are looking for: signed authorization records, decision audit trails, and PDF compliance packages in NIST language.

Worth 15 minutes to walk through it? Reply and we can find a time.

Kevin Colahan, PMP
Partner, GreyLee Services Group (SDVOSB, CAGE 0Q6E5)
Founder, AgentLedger`,
    segment: "federal",
  },
  {
    delayDays: 5,
    subject: "Following up — one specific example",
    body: `Hi {{firstName}},

Circling back. I know {{company}} likely has multiple vendors and AI tools in flight, so I'll be specific about where I've seen this come up.

The scenario: a subcontractor deploys an AI agent that autonomously submits data calls, manages file transfers, or interacts with a government portal. The agent has its own credentials and acts without human intervention for each step.

In a recent C3PAO assessment, the auditor asked: "Show me the authorization for this agent to take these actions, and show me a log of what it actually did." The contractor had neither.

AgentLedger produces both. The authorization record is a signed, blockchain-anchored document that defines the agent's scope. The audit trail is a Merkle-anchored session log of every reasoning step and transaction.

Does this scenario apply to anything in your current program? Happy to take a look if you want to share what you're working with.

Kevin`,
    segment: "federal",
  },
  {
    delayDays: 9,
    subject: "Last note on AI agent compliance",
    body: `Hi {{firstName}},

One last note — I don't want to clog your inbox.

If CMMC AI agent governance isn't on your radar right now, that's completely fair. The assessment landscape is still evolving and not every C3PAO is asking about it yet.

If it becomes relevant — either for an upcoming assessment or because your team starts deploying agents — agentledger.io is here. The Federal tier ($999/mo) is built specifically for this use case.

I'm also happy to share more context on how other defense contractors are thinking about this. Just reply.

Kevin Colahan
GreyLee Services Group / AgentLedger`,
    segment: "federal",
  },
];

// ─── Solana builder outreach (3 steps) ────────────────────────────────────────

export const SOLANA_SEQUENCE: SequenceStep[] = [
  {
    delayDays: 0,
    subject: "Production compliance for {{agentName}}",
    body: `Hi,

I saw {{agentName}} in the Solana Agent Registry — looks like you've got a live agent.

As you scale to enterprise clients or regulated environments, the question that usually comes up is: can you prove what your agent was authorized to do, and that it stayed within that scope?

I built AgentLedger for exactly this. It's a compliance layer for Solana agents: signed authorization records, reasoning-to-transaction audit trails, Merkle-anchored on Solana, and PDF audit packages for CFOs and auditors.

The SDK integrates in 6 lines with ElizaOS, SAK, or any custom runtime. It captures what the agent intended to do (reasoning summary) and what it actually did (tool calls, tx signatures) — without sending raw prompts anywhere.

Worth a look: agentledger.io/verify shows how the on-chain anchoring works.

Kevin
AgentLedger`,
    segment: "solana",
  },
  {
    delayDays: 6,
    subject: "SDK for {{agentName}} — 6 lines",
    body: `Following up on AgentLedger.

If you want to try the SDK with {{agentName}}:

npm install @agentledger/sdk

Then wrap your existing action execution:

  const ledger = new AgentLedger({
    apiKey: 'your-key', // from agentledger.io
    agentWalletAddress: 'your-wallet',
  });

  await ledger.executeWithAudit(
    'What the agent is doing',
    () => yourExistingAction()
  );

That's it. Reasoning + tx captured. Sessions anchored on Solana.

Free tier covers 5 wallets. No card required.

Kevin`,
    segment: "solana",
  },
  {
    delayDays: 10,
    subject: "Last one — MCP server if you use Claude Code",
    body: `Last note.

If you use Claude Code with your agents, there's also an MCP server:

  npx skills add agentledger/mcp

Gives Claude Code direct access to AgentLedger tools — check authorization scope before acting, log reasoning, generate compliance reports — without any SDK code changes.

agentledger.io if you want to explore. Happy to answer questions on the Solana Discord too.

Kevin`,
    segment: "solana",
  },
];

// ─── Mapping for DB seeding ───────────────────────────────────────────────────

export const ALL_SEQUENCES = [
  { name: "New User Onboarding",           steps: ONBOARDING_SEQUENCE, targetAudience: "enterprise" },
  { name: "Federal Contractor Outreach",   steps: FEDERAL_SEQUENCE,    targetAudience: "federal"    },
  { name: "Solana Builder Outreach",       steps: SOLANA_SEQUENCE,     targetAudience: "solana"     },
];
