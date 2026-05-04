# Project Context

## Purpose

A self-hosted personal investment portfolio tracker. Records buy/sell/dividend transactions across crypto and equity platforms, normalises everything to AUD, fetches daily prices from Yahoo Finance, and shows holdings, dashboard, charts, and rebalance recommendations against category targets. Single-user, password-protected, multi-profile.

## Tech Stack

- **Runtime**: Next.js 16 (App Router), React 19, Node 20+
- **Language**: TypeScript (strict)
- **DB**: SQLite via `@libsql/client` + Drizzle ORM. Local file (`local.db`) in dev; Turso in prod (optional).
- **Migrations**: `drizzle-kit` (schema in `src/db/schema.ts`, migrations in `drizzle/`)
- **Auth**: Single-password login; `bcryptjs` for hashing; `jose` JWT in HTTP-only `session` cookie; middleware in `src/middleware.ts`
- **UI**: Tailwind CSS v4, shadcn/ui (Radix primitives), `lucide-react`, `next-themes`, `sonner` toasts, `recharts`
- **Forms**: `react-hook-form` + `zod` via `@hookform/resolvers`
- **Prices**: `yahoo-finance2`
- **Imports**: `xlsx` (CSV/XLSX), `pdf-parse` (PDF), `imapflow` + `mailparser` (email auto-import)
- **Email**: Resend (optional notifications)
- **Deployment**: Vercel (`vercel.json`) or self-hosted on Raspberry Pi (`setup-pi.sh`: PM2 + nginx)

## Project Conventions

### Code Style

- TypeScript strict mode; prefer `interface` for public shapes, `type` for unions/aliases.
- Path alias `@/` → `src/`.
- Server-only modules go in `src/lib/` and `src/db/`. They must never be imported from client components.
- API routes return `NextResponse.json(...)`. Error path: `{ error: string }` with appropriate status; success path is the bare payload.
- Keep route handlers thin — push business logic into `src/lib/`.
- All monetary values stored and computed in AUD (`*_aud` columns). Foreign-currency context is preserved in `unit_price_local`, `local_currency`, `fx_rate`.
- Dates: ISO `YYYY-MM-DD` strings in DB; `date-fns` for formatting.

### Architecture Patterns

- **App Router** with server components by default; client components opt in with `"use client"`.
- **Profile scoping**: most reads/writes accept a `profileId` resolved from the `profile` cookie via `src/lib/profile.ts`. Default profile is `1`.
- **Derived state**: holdings, dashboard summary, drift, and value history are computed on demand from `transactions` + `prices` (no materialised holdings table). See `src/lib/calculations.ts` and `src/lib/rebalance.ts`.
- **Cron endpoints** under `/api/cron/*` are gated by `CRON_SECRET` (query param or header) and excluded from auth middleware.
- **Importers** are per-source modules under `src/lib/` (`import-parser.ts`, `cmc-import.ts`, `cmc-email-parser.ts`) plus per-source routes in `src/app/api/import/<source>/`.

### Testing Strategy

No automated tests today. Manual verification against a seeded local DB is the current bar. New behaviour should at minimum be exercised end-to-end via the dev server before merge. Adding Vitest + a small integration harness is a known follow-up.

### Git Workflow

- `main` is the long-lived branch and what deploys.
- Feature branches: `feature/<short-slug>` or `fix/<short-slug>`.
- Commits in imperative mood; short subject + optional body.
- PRs squash-merge into `main`.
- Repo is private until the author opts to flip it public.

## Domain Model (current)

- **profiles**: a portfolio owner / namespace. Most data is profile-scoped.
- **assets**: tracked instrument (symbol, display ticker, Yahoo symbol, category, platform, active flag).
- **transactions**: buy/sell/dividend/split events; AUD-normalised with split-adjusted quantity.
- **prices**: per-asset daily closing price in AUD (and optional USD + FX rate).
- **category_targets**: target % per category per profile, with a drift threshold.
- **settings**: singleton row — password hash, optional notification email, last-run timestamps for cron jobs.
- **cmc_account_mappings**: maps a CMC account number to a profile, used by IMAP auto-import.

## Domain Context

- "CMC" = CMC Markets (AU broker). "Stake" = stake.com.au (AU broker). "Swyftx" = AU crypto exchange. "IR" = Independent Reserve (AU crypto exchange).
- Splits and renames are reflected via `split_multiplier` and `adjusted_qty` on transactions.
- Categories are free-form strings (e.g. `Crypto`, `AU Equities`, `US Equities`, `Gold`); they are the unit of rebalance targeting.

## Important Constraints

- Single-user app. Auth is intentionally password-only — no user table, no roles. Don't add multi-tenant assumptions.
- Must run on a Raspberry Pi (low memory). Avoid heavy build-time work and keep runtime memory modest.
- Data is treated as authoritative once entered; importers must be idempotent (check for duplicate transactions before insert).

## External Dependencies

- **Yahoo Finance** (`yahoo-finance2`): prices and AUD/USD FX. No key. Subject to upstream rate-limits and occasional symbol churn.
- **Turso / libSQL**: optional remote SQLite. Falls back to `file:local.db`.
- **Resend**: optional outbound email. Only used when `RESEND_API_KEY` is set.
- **IMAP** (Gmail by default): polled by `/api/cron/email` to auto-ingest CMC trade confirmations.
