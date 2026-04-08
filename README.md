# AgentLedger

**The compliance and audit layer for enterprise AI agent operators on Solana.**

AgentLedger fills the gap between spend monitoring (Analytix402) and general accounting (Cryptio). It produces the paper trail that CFOs, internal auditors, CMMC assessors, and CPAs actually need when an organization is running autonomous agents that transact on-chain 24/7.

---

## What it does

| Need | Solution |
|---|---|
| "Prove this agent was authorized to do what it did" | Signed authorization records anchored on Solana via memo transactions |
| "Show me the reasoning behind each transaction" | Decision audit trail (reasoning → tool call → tx signature), Merkle-anchored per session |
| "We need an audit package for our CMMC assessment" | Single-click PDF export: cover page, auth records, findings, attestation block — NIST SP 800-53 language option |
| "Our CPA needs per-wallet tax reporting" | Helius-powered tx history, per-wallet cost basis (IRS 2026 rules), staking/x402/swap classification |
| "Flag when agents go outside their authorized scope" | Claude-powered nightly policy scan with rule-based + reasoning-consistency checks |

---

## Architecture

```
┌─────────────────────────────┐   ┌──────────────────────────────────┐
│  @agentledger/sdk            │   │  AgentLedger Platform (Railway)  │
│  (npm package)               │   │                                  │
│  ┌─────────────────────┐    │   │  Next.js 14 app (Vercel)         │
│  │ executeWithAudit()  │────┼──▶│  Ingest API (separate Railway)   │
│  │ logReasoning()      │    │   │  Policy engine (Claude Batch)    │
│  │ logAction()         │    │   │  Tax module (Helius)             │
│  └─────────────────────┘    │   │  PDF generator (react-pdf)       │
│                             │   │  R2 report storage               │
│  Agent runtime:             │   └──────────────┬───────────────────┘
│  ElizaOS / SAK / GOAT       │                  │
└─────────────────────────────┘                  ▼
                                    ┌────────────────────────┐
                                    │  Solana (memo anchors) │
                                    │  Railway Postgres      │
                                    │  Helius RPC            │
                                    │  Cloudflare R2         │
                                    └────────────────────────┘
```

**Two Railway services:**
- `web` — Next.js 14 app (or deploy to Vercel for free tier)
- `ingest` — standalone Express service for high-volume SDK event ingestion

---

## Local setup

### Prerequisites
- Node.js 20+
- PostgreSQL (Railway or local)
- Accounts: Resend, Helius, Cloudflare R2, Stripe (optional for billing)
- A Solana wallet with ~0.05 SOL for anchor transactions (optional for local dev)

### 1. Clone and install

```bash
git clone https://github.com/yourusername/agentledger
cd agentledger
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in at minimum:
- `DATABASE_URL` — your Postgres connection string
- `AUTH_SECRET` — run `openssl rand -base64 32`
- `RESEND_API_KEY` — from resend.com
- `ANTHROPIC_API_KEY` — from console.anthropic.com

For full functionality also add:
- `HELIUS_API_KEY` — from helius.xyz (free tier works)
- `SOLANA_ANCHOR_PRIVATE_KEY` — byte array of a funded Solana keypair
- `R2_*` — Cloudflare R2 credentials for PDF storage

### 3. Set up database

```bash
npm run db:push        # apply schema to your database
npm run db:generate    # generate Prisma client
npm run db:seed        # create demo data (optional)
```

### 4. Run locally

```bash
npm run dev            # Next.js app on :3000

# In a second terminal (optional — for testing SDK ingest):
cd services/ingest
npm install
npm run dev            # Ingest service on :3001
```

Visit `http://localhost:3000` → landing page
Sign in at `http://localhost:3000/login` with `demo@agentledger.io`

In development, magic link emails are logged to the console instead of sent.

---

## SDK integration

```bash
npm install @agentledger/sdk
```

```typescript
import { AgentLedger } from '@agentledger/sdk';

const ledger = new AgentLedger({
  apiKey: process.env.AGENTLEDGER_KEY,        // from Settings page
  agentWalletAddress: process.env.WALLET_ADDRESS,
  framework: 'solana-agent-kit',              // or elizaos, goat, custom
});

// Wrap your agent's action execution
const result = await ledger.executeWithAudit(
  'Rebalancing: swapping 50 USDC to SOL for Blueprint staking yield',
  () => agentKit.swap({ inputMint: USDC, outputMint: SOL, amount: 50 })
);

// End session on shutdown — triggers Merkle anchoring
process.on('SIGTERM', () => ledger.endSession());
```

For ElizaOS:
```typescript
import { createElizaOSPlugin } from '@agentledger/sdk';

// Add to character plugins
const agentLedgerPlugin = createElizaOSPlugin({
  apiKey: process.env.AGENTLEDGER_KEY,
  agentWalletAddress: process.env.WALLET_ADDRESS,
});
```

Install as an agent skill (agents self-install):
```bash
npx skills add agentledger/audit-sdk
```

---

## Deployment

### Vercel (web app)

```bash
vercel --prod
```

Set all environment variables in the Vercel dashboard.

### Railway (ingest service)

1. Create a new Railway service pointing to `/services/ingest`
2. Build: `npm install && npm run build`
3. Start: `node dist/server.js`
4. Set env vars: `DATABASE_URL`, `SOLANA_ANCHOR_PRIVATE_KEY`, `AUTH_SECRET`

### Cron job (policy scan)

In Railway, create a cron job:
```
Schedule:  0 2 * * *
Command:   curl -X POST https://your-domain.com/api/cron/policy-scan -H "Authorization: Bearer $CRON_SECRET"
```

Generate your cron secret:
```bash
npm run generate:cron-secret
```

### Stripe (billing)

1. Create products in Stripe dashboard for Starter ($49), Professional ($199), Enterprise ($999)
2. Set price IDs in the `PLAN_MAP` in `app/api/stripe/webhook/route.ts`
3. Point Stripe webhook to `https://your-domain.com/api/stripe/webhook`

---

## Project structure

```
agentledger/
├── app/
│   ├── (auth)/            # Login, verify pages
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── agents/        # Agent wallet management
│   │   ├── findings/      # Policy findings review
│   │   ├── reports/       # Audit package generation
│   │   └── settings/      # Org settings, API keys
│   ├── (marketing)/       # Public landing page
│   └── api/               # API routes
├── lib/
│   ├── auth.ts            # NextAuth v5 config
│   ├── pdf.ts             # Audit package PDF generator
│   ├── policy-engine.ts   # Claude compliance analysis
│   ├── r2.ts              # Cloudflare R2 storage
│   ├── solana.ts          # On-chain anchoring
│   └── tax.ts             # Helius tax classification
├── packages/sdk/          # @agentledger/sdk npm package
├── prisma/
│   ├── schema.prisma      # Full database schema
│   └── seed.ts            # Development seed data
└── services/ingest/       # Standalone ingest service
```

---

## Pricing tiers

| | Starter | Professional | Enterprise |
|---|---|---|---|
| Price | $49/mo | $199/mo | $999/mo |
| Agent wallets | 5 | 25 | Unlimited |
| Log retention | 90 days | 1 year | Unlimited |
| PDF formats | Standard | All | All + white-label |
| Federal/CMMC format | — | — | ✓ |
| API access | — | ✓ | ✓ |

---

## On-chain anchoring

AgentLedger uses the [Solana Memo Program](https://spl.solana.com/memo) to anchor record hashes on-chain. Each anchor transaction costs ~$0.00025.

**Authorization records:**
```
Memo: AL:AUTH:v1:{orgId}:{agentWalletId}:{authId}:{sha256Hash}
```

**Audit sessions (Merkle root):**
```
Memo: AL:SESSION:v1:{orgId}:{sessionId}:{merkleRoot}:{eventCount}
```

Anchored transactions are publicly verifiable on any Solana explorer (Solscan, SolanaFM). The hash in the memo can be independently verified against the record in AgentLedger.

Fund the platform anchor wallet with 0.05 SOL to cover ~200,000 anchor transactions.

---

## Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Vercel
- **Backend**: Next.js API routes + standalone Express ingest service
- **Database**: PostgreSQL via Prisma (Railway)
- **Auth**: NextAuth v5, magic link via Resend
- **AI**: Anthropic Claude (policy analysis, reasoning consistency)
- **Blockchain**: Solana web3.js, Helius Enhanced Transactions API
- **Storage**: Cloudflare R2 (PDF reports)
- **Payments**: Stripe
- **PDF**: @react-pdf/renderer

---

## License

MIT
