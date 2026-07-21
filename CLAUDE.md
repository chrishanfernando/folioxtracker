# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Multi-user investment portfolio tracker for Australian DIY investors. Next.js 16 App Router
· React 19 · TypeScript strict · Drizzle ORM on libSQL/SQLite (Turso in prod) · Better Auth
· Tailwind v4 + shadcn/ui · recharts. All monetary values are stored in AUD; foreign-currency
context (`unit_price_local`, `fx_rate`) is preserved alongside. Holdings are **derived at
read time from the transactions ledger** (`src/lib/calculations.ts`) — there is no holdings
table. Note: `README.md` predates the multi-user migration (it describes a single-password
JWT setup); trust the code and this file over it.

## Commands

```bash
npm run dev                      # dev server (Turbopack)
npm run build                    # drizzle-kit migrate && next build — see gotcha below
npx tsc --noEmit                 # typecheck (use this; CI runs it via next build)
npx drizzle-kit generate         # new migration after editing src/db/schema.ts
npx drizzle-kit migrate          # apply migrations
npm run metrics                  # product-metrics report to terminal
```

There is no test runner yet (adding vitest is on the TODO). `npm run lint` is **broken
repo-wide** — eslint 10 is incompatible with the eslint-plugin-react bundled inside
eslint-config-next (`contextOrFilename.getFilename is not a function`); CI's "lint" step
passes only because the build is what gates. Don't burn time on lint output until eslint
is pinned back to 9.x.

### Build gotchas (these cost real debugging time)

- `npm run build` runs `drizzle-kit migrate` first. The developer's `local.db` was created
  via `drizzle-kit push`, so its `__drizzle_migrations` table is **empty** and migrate
  fails against it. For a CI-style verification build, point at a fresh file:
  `TURSO_DATABASE_URL="file:/tmp/check.db" npm run build`. CI does the same with `ci.db`.
- DB URL env vars: `drizzle.config.ts` and `src/db/index.ts` read `TURSO_DATABASE_URL`
  (default `file:local.db`) — not `DATABASE_URL`, which `env.ts` also declares.
- `src/lib/env.ts` validates env at module load. Empty-string vars (e.g. `IMAP_USER=`)
  are treated as unset via `emptyToUndefined`. Strict prod validation is skipped during
  `next build` (`NEXT_PHASE === 'phase-production-build'`) and enforced at `next start`.
- `xlsx` is pinned to the SheetJS CDN tarball (`cdn.sheetjs.com/xlsx-0.20.3`), not the npm
  registry — npm's newest xlsx (0.18.5) has unfixed CVEs. Don't "update" it back.
- `.gitignore` ignores `*.csv`/`*.xlsx`/`*.db` globally (real broker exports and personal
  data live in the repo dir); `public/samples/*.csv` has an explicit un-ignore exception.

## Architecture

### Tenancy: user → profile → asset → transaction/price

Every request is scoped twice. Better Auth gives the user; the **active profile** comes
from the `x-profile-id` request header, sent by the client via `profileFetch()`
(`src/components/profile-context.tsx`) and resolved server-side by `resolveProfileId()`
(`src/lib/profile.ts`), which falls back to the user's first profile and 404s on profiles
the user doesn't own. Assets belong to profiles; transactions and prices hang off assets.
Ownership checks are centralized in `src/lib/auth-helpers.ts`
(`requireUser` / `requireProfileOwnership` / `requireAssetOwnership` /
`requireTransactionOwnership`) and deliberately return **404, not 403**, to avoid leaking
existence. Prices are keyed by assetId but looked up across sibling assets sharing a
`yahooSymbol` (see `buildYahooSymbolToAssetIds` in calculations.ts).

### API route pattern (follow it exactly)

```ts
const user = await requireUser();                 // returns SessionUser | NextResponse
if (user instanceof NextResponse) return user;    // the union-return idiom used everywhere
const profileId = await resolveProfileId(request, user.id);
if (profileId instanceof NextResponse) return profileId;
const body = await parseJsonBody(request, someZodSchema);  // schemas are .strict()
...
} catch (error) {
  return apiError(error, { route: '/api/x', method: 'POST' });  // request-id + Sentry
}
```

Zod schemas build on `src/lib/validation/primitives.ts` (`aud`, `isoDate`,
`sanitizedString(n)`, …). `apiError` (`src/lib/api-error.ts`) maps ZodError→400,
`AppError` subclasses→their status, everything else→500 with `Sentry.captureException`
(no-op until `SENTRY_DSN` is set) and an `x-request-id` header. Client messages never
include internals.

### Auth (`src/lib/auth.ts`, `src/middleware.ts`)

Better Auth: email/password with mandatory verification + Google OAuth. Passwords are
scrypt; a custom verifier also accepts legacy bcrypt hashes read-only. Middleware does a
**cheap cookie-presence check only** (public paths listed in `PUBLIC_PATHS`; `/` is public
— the landing page itself redirects authed users); real session verification happens in
each handler via `requireUser`. Rate limiting is Better Auth's built-in (prod-only, strict
per-endpoint rules on sign-in/sign-up/reset) plus an in-memory sliding-window limiter for
imports (`src/lib/rate-limit.ts` + `rate-limit-guard.ts`) — both are single-instance by
design (RPi/Vercel single instance); move to Redis only if that changes.
`user.deleteUser.beforeDelete` cascades profile data manually because the SQLite ALTER
TABLE that added `profiles.user_id` dropped the ON DELETE CASCADE clause.

### Cron (`/api/cron/*`, `src/lib/cron-auth.ts`)

Gated by `Authorization: Bearer <CRON_SECRET>` — header only (query-string support was
removed; it leaked into logs), compared with `timingSafeEqual`. Vercel cron sends the
header automatically (`vercel.json`). Runs are recorded in `cron_runs`
(`src/lib/cron-runs.ts`); `/api/cron/status` is visible to every authed user, so summaries
returned there collapse error arrays to counts (they can contain other users' account
details). Manual poll from settings goes through the session-authed
`POST /api/settings/poll-email` — **never** put `CRON_SECRET` in client code or
`NEXT_PUBLIC_*`.

### Imports (`src/app/api/import/*`, `src/lib/import-parser.ts`)

Five importers (generic Excel, CMC CSV, Stake XLSX, Swyftx CSV, Independent Reserve CSV)
plus IMAP auto-import of CMC confirmation-email PDFs (`email-poll.ts` → `cmc-email-parser.ts`
→ `cmc-import.ts`). Shared rules:

- Upload guard: `requireUploadFile(formData)` — `instanceof File` + 10 MB cap (413).
- Per-user/IP rate limit: `checkImportLimit(user.id, request.headers)`.
- Two-phase UX: `preview=true` form field returns a dry-run table; confirm re-posts.
- **Replace semantics are source-scoped**: IR/Swyftx delete only rows with their own
  `source` before re-inserting; the generic Excel import replaces *all* transactions for
  mapped assets. Every delete + re-insert runs inside `db.transaction()` — keep it that way.
- Dedupe/idempotency key is `(assetId, date, action, quantity, unitPriceAud)` — `feeAud`
  is deliberately NOT part of the key.
- Ticker resolution goes through `src/lib/ticker-map.ts` (`ASSET_MAP`, `CMC_TICKER_MAP`,
  per-broker resolvers). New assets are seeded with `merBps: lookupMerBps(yahooSymbol)`.

### Money semantics (fees feature, `src/lib/fees.ts`, design doc in
`openspec/changes/fees-cost-transparency/design.md`)

- `transactions.total_aud` is **gross** (fees included) — never re-derive it net.
  `transactions.fee_aud` is the breakdown; **null means unknown, not zero**.
- `assets.mer_bps` (basis points, int): null = unknown → excluded from both numerator and
  denominator of the weighted MER. Same null-discipline everywhere in the fees API.
- CMC CSV brokerage is *derived* (cash movement − qty×price) with a plausibility guard
  `[0, max($100, 5%)]`; outside the guard → null.

### Frontend conventions

All authed pages are `'use client'`, wrapped in `<AppShell>` (sidebar + mobile bottom nav
with a More overflow — nav items live in one `navItems` array in
`src/components/layout/app-shell.tsx` and appear in both navs automatically). Data fetching
is plain `profileFetch` in `useEffect` (no SWR yet — planned). Pages should distinguish
three render states: loading, **error (with retry)**, and empty — the dashboard is the
reference implementation; conflating error with empty reads as data loss in a finance app.
Toasts via `sonner`. There is no forced onboarding gate — new users land on the dashboard.

### Model portfolios (`/portfolios`, `src/lib/model-portfolios.ts`)

`/portfolios` is an **educational library** of four labelled example portfolios
(conservative/balanced/growth/aggressive), NOT personalised advice — deliberately reframed
to stay clear of *personal financial product advice* under the Corporations Act. The user
can copy an example's category split into their own rebalance targets via
`POST /api/portfolios/apply-template` (an explicit, self-directed choice). The buy recommender
(`src/lib/rebalance.ts`) intentionally does **not** suggest specific ETFs for empty categories.
The prior questionnaire-driven `/risk-profile` feature (quiz → personal tier → "your
recommended ETFs" + `OnboardingGate`) is retired to `archive/risk-profile-quiz/` with a restore
README; the `risk_profiles` table remains in `schema.ts` (no drop migration) so it can be revived.

## Workflow

- **OpenSpec (spec-driven)**: non-trivial features flow through `openspec/changes/<name>/`
  (proposal → design → specs → tasks) via the `/opsx:*` commands and skills in
  `.claude/skills/`. Read `openspec/config.yaml` for the artifact rules and
  `openspec/project.md` for full project context. Tick task checkboxes only when the work
  is actually done — and verify ticked tasks still exist in code after any messy merge
  (an entire feature's integration edits were once lost in a conflict resolution while
  its tasks stayed ticked).
- **Git**: feature branches PR'd into `main`; CI = lint/typecheck/build (fresh SQLite:
  `TURSO_DATABASE_URL=file:ci.db` + placeholder secrets), CodeQL. Never commit directly
  to main.
- `TODO.md` at the repo root is the consolidated launch backlog — check it before
  proposing "what's next", and keep it updated as items land.

## Current known state (as of 2026-07-19)

- **Brand**: the product is **FolioX Tracker** at `folioxtracker.com`; legal entity is
  FolioX Tracker (sole operator); support/contact is `hello@folioxtracker.com`. The old
  `{{BRAND}}` / `{{LEGAL_ENTITY}}` / `{{SUPPORT_EMAIL}}` placeholders were filled in
  2026-07-21 (landing, legal pages, chrome, email templates, `.env.example`). Sender
  identity still needs a Resend-verified `folioxtracker.com` domain before prod email works.
- Sentry is fully wired (instrumentation files, apiError, error boundaries) but inert
  until `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set in the deploy environment.
- IR fee extraction is deferred: `public/samples/independent-reserve-sample.csv` does not
  match the real parser's column layout (see task 4.7 in the fees change) — needs a real
  export before mapping the Fee column.
- Fees manual smoke test (task 9.2 in `openspec/changes/fees-cost-transparency/tasks.md`)
  is still owed; after it passes, archive the change with `/opsx:archive`.
- `npm audit`: 6 moderates remain, all postcss-bundled-in-Next; no stable fix until
  Next 16.3.
- Next 16.2 logs a deprecation for the `middleware.ts` convention (→ `proxy.ts`).
