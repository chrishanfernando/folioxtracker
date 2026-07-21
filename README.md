# Portfolio Tracker

Self-hosted personal investment portfolio tracker. Records trades across crypto and equity platforms, normalises everything to AUD, fetches daily prices from Yahoo Finance, and shows holdings, charts, and rebalance recommendations against category targets.

Single-user, password-protected, multi-profile. Runs on Vercel or on a Raspberry Pi.

## Features

- **Transactions ledger** — buy/sell/dividend/split, AUD-normalised, foreign-currency context preserved.
- **Holdings & dashboard** — derived in real time from the ledger; total value, cost basis, P/L, CAGR, category breakdown.
- **Prices** — daily Yahoo Finance fetch, multi-year backfill on demand, AUD/USD FX conversion.
- **Rebalance** — set target % per category; see drift, get buy-only recommendations to move toward target.
- **Imports** — file uploads for CMC Markets, Stake, Swyftx, Independent Reserve; legacy XLSX (`Tx` sheet); IMAP auto-import of CMC trade-confirmation emails.
- **Multi-profile** — namespace assets/transactions/targets per portfolio.
- **Notifications** — optional Resend email when drift breaches threshold.
- **Cron** — `/api/cron/{prices,rebalance,email}` gated by a shared secret.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 + shadcn/ui · Drizzle ORM · libSQL/Turso · `yahoo-finance2` · `imapflow` + `mailparser` · Resend · `recharts`.

## Getting started

```bash
git clone git@github.com:chrishanfernando/folioxtracker.git
cd folioxtracker
npm install
cp .env.example .env.local
# edit .env.local — at minimum set JWT_SECRET and CRON_SECRET
npx drizzle-kit push          # create the SQLite schema in local.db
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. The first password you submit becomes the password for the app.

## Environment

Variables are documented in [`.env.example`](./.env.example).

| Var | Required | Notes |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | `file:local.db` for local; libSQL URL for Turso |
| `TURSO_AUTH_TOKEN` | only for remote Turso | leave blank locally |
| `JWT_SECRET` | yes in prod | sign session cookies; `openssl rand -hex 32` |
| `CRON_SECRET` | yes if cron is exposed | shared secret for `/api/cron/*` |
| `RESEND_API_KEY` | optional | enables email notifications |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_USER` / `IMAP_PASSWORD` | optional | enables `/api/cron/email` CMC auto-import |
| `FORCE_HTTPS` | optional | set to `true` to mark session cookies `Secure` |
| `ADMIN_EMAILS` | optional | comma-separated emails allowed to view `/admin/metrics`; empty = nobody |

## Scripts

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
npm run metrics  # print the product-metrics report to the terminal
npx drizzle-kit push       # apply schema to the configured DB
npx drizzle-kit generate   # generate a new migration from schema changes
```

## Analytics & metrics

The app captures a small, first-party, privacy-preserving set of product
metrics so you can see sign-ups, activation, retention, and which features are
(and aren't) used. No third-party analytics SaaS is involved.

**What's measured**

- **Acquisition → activation funnel** and **email-verification rate**, **retention**
  (D7/D30), and a weekly-active-users trend — all derived from the Better Auth
  `user`/`session` tables, so they work retroactively for existing accounts.
- **Feature adoption** (logging transactions, imports per source, setting targets,
  rebalance, risk profile, dashboard views, exports) and **server errors** — from a
  first-party `analytics_events` table populated via `src/lib/analytics.ts`.

**Privacy.** No dollar amounts (portfolio value is bucketed), no holdings, no
free text. Events stay in your own SQLite/Turso DB. Each user can opt out under
**Settings → Privacy & Analytics** (`user_settings.analytics_opt_out`).

**How to read it**

- Web dashboard: **`/admin/metrics`** — restrict access by setting `ADMIN_EMAILS`
  to your email(s). Non-admins get a 404.
- Terminal: **`npm run metrics`** — same numbers, no UI.

See [`docs/product/06-metrics-plan.md`](./docs/product/06-metrics-plan.md) for
the full taxonomy and the decision each metric is meant to inform.

## Cron

Trigger from any external scheduler. Either query string or bearer header works.

```
curl -fsS "https://<host>/api/cron/prices?secret=$CRON_SECRET"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/cron/rebalance"
curl -fsS "https://<host>/api/cron/email?secret=$CRON_SECRET"
```

Suggested cadence: prices daily after market close, rebalance weekly, email every 15 min.

## Deployment

### Vercel

`vercel.json` is included. Set the env vars in the Vercel project; point `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` at a Turso DB. Configure Vercel Cron entries against the `/api/cron/*` endpoints with the `?secret=$CRON_SECRET` query.

### Raspberry Pi

```bash
chmod +x setup-pi.sh
./setup-pi.sh
```

Installs Node 20, builds the app, runs it under PM2, and fronts it with nginx on port 80. See the script header for what it does step-by-step.

## OpenSpec-driven development

This project tracks behaviour in [`openspec/`](./openspec). Specs are the source of truth for **what** the system does; code is the implementation.

- [`openspec/project.md`](./openspec/project.md) — stack, conventions, domain model.
- [`openspec/AGENTS.md`](./openspec/AGENTS.md) — how to use OpenSpec in this repo (also the brief for AI assistants).
- [`openspec/specs/<capability>/spec.md`](./openspec/specs) — the current truth, one folder per capability (auth, profiles, assets, transactions, holdings, prices, rebalance, import, dashboard, charts, settings, cron, risk-profiles, benchmarks, legal).
- [`openspec/changes/<change-id>/`](./openspec/changes) — proposed/in-progress changes with proposal, tasks, and a spec delta.

Workflow for non-trivial work:

1. Open a change folder under `openspec/changes/<change-id>/` with `proposal.md`, `tasks.md`, and the spec delta.
2. Implement against the delta, ticking tasks as you go.
3. On merge, fold the delta back into `openspec/specs/<capability>/spec.md` and remove the change folder.

Trivial fixes (typos, dependency bumps that don't change behaviour) skip the change folder.

## Repository

Private during early development. The intent is to make it public once the spec coverage and the importer set are stable.

## Licence

No licence file yet — all rights reserved while the repo is private.
