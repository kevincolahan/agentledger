# AgentLedger — Railway deployment
# Two services in the same repo:
#   1. Web (Next.js) — the main app
#   2. Ingest — standalone event ingestion service

# ── Service 1: Web (Next.js on Vercel or Railway) ─────────────────────────────
# Build command: npm run build
# Start command: npm start
# Port: 3000

# ── Service 2: Ingest (Railway) ───────────────────────────────────────────────
# Build command: cd services/ingest && npm install && npm run build
# Start command: node services/ingest/dist/server.js
# Port: 3001 (set via PORT env var)

# ── Cron job (Railway) ────────────────────────────────────────────────────────
# Command: curl -X POST https://agentledger.io/api/cron/policy-scan \
#            -H "Authorization: Bearer $CRON_SECRET"
# Schedule: 0 2 * * * (2 AM UTC daily)

# ── Required environment variables ───────────────────────────────────────────
# See .env.example for full list.
# Additional for ingest service:
#   AGENTLEDGER_INGEST_SECRET=  (shared secret for SDK → ingest auth)
#   CRON_SECRET=                (random secret for cron job auth)

## Cron jobs

| Job | Schedule | Endpoint |
|---|---|---|
| Nightly policy scan | `0 2 * * *` | POST `/api/cron/policy-scan` |
| Anchor retry | `0 * * * *` | POST `/api/cron/anchor-retry` |

All cron jobs use Bearer token auth via `CRON_SECRET`.

## New env vars (since initial deploy)

```
STRIPE_PRICE_PROFESSIONAL=price_...  # from Stripe dashboard
STRIPE_PRICE_ENTERPRISE=price_...    # from Stripe dashboard
NEXT_PUBLIC_APP_URL=https://agentledger.io
```
