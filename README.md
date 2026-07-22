# FolioX Tracker

Multi-user investment portfolio tracker for Australian DIY investors. Records trades across crypto and equity platforms, normalises everything to AUD, fetches daily prices from Yahoo Finance, and shows holdings, charts, and rebalance recommendations against category targets.

Runs as a hosted service at **[folioxtracker.com](https://folioxtracker.com)** (deployed on Vercel). The code is also open, so you can self-host it — on your own Vercel project or a Raspberry Pi — if you'd rather run your own instance.

Multi-user with email/password (verified) and Google sign-in; each account can keep multiple named portfolios (profiles).

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

## Running it yourself

The hosted app lives at [folioxtracker.com](https://folioxtracker.com). To run a local
copy for development or self-hosting:

```bash
git clone git@github.com:chrishanfernando/folioxtracker.git
cd folioxtracker
npm install
cp .env.example .env.local
# edit .env.local — at minimum set BETTER_AUTH_SECRET, BETTER_AUTH_URL, and CRON_SECRET
npx drizzle-kit push          # create the SQLite schema in local.db
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Create an account with
email/password (or Google); email/password sign-ups require verifying the address before
you can sign in. Each account starts with one portfolio profile and can add more.

## Environment

Variables are documented in [`.env.example`](./.env.example).

| Var | Required | Notes |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | `file:local.db` for local; libSQL URL for Turso |
| `TURSO_AUTH_TOKEN` | only for remote Turso | leave blank locally |
| `BETTER_AUTH_SECRET` | yes in prod | signs sessions; `openssl rand -hex 32`. (`JWT_SECRET` is accepted as a legacy fallback.) |
| `BETTER_AUTH_URL` | yes in prod | canonical app origin, e.g. `https://folioxtracker.com`; a wrong value breaks logout |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | enables Google sign-in |
| `CRON_SECRET` | yes if cron is exposed | bearer secret for `/api/cron/*` |
| `RESEND_API_KEY` | optional | enables email (verification + notifications) |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_USER` / `IMAP_PASSWORD` | optional | enables `/api/cron/email` CMC auto-import |
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

Trigger from any external scheduler. Authentication is **header-only** — the secret goes in
an `Authorization: Bearer` header (query-string secrets were removed because they leak into
access logs and proxies).

```
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/cron/prices"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/cron/rebalance"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/cron/email"
```

Suggested cadence: prices daily after market close, rebalance weekly, email every 15 min.
On the hosted deployment these run via Vercel Cron (`vercel.json`), which sends the bearer
header automatically.

## Deployment

### Vercel (how the hosted app runs)

The live site is a Vercel project connected to this repo: **merging to `main` builds and
promotes to production automatically**, and each PR gets its own preview deployment. See
[`docs/deployment.md`](./docs/deployment.md) for the deploy/preview details.

To run your own Vercel instance: set the env vars in the project and point
`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` at a Turso DB. Cron is defined in `vercel.json`
(`/api/cron/prices`, `/api/cron/rebalance`); Vercel sends the `Authorization: Bearer
$CRON_SECRET` header automatically, so no query-string secret is needed.

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

Public. The hosted product is live at [folioxtracker.com](https://folioxtracker.com);
the source is open for reference and self-hosting.

## Licence

No licence file yet — all rights reserved. If you'd like to reuse the code, open an issue
to ask.
