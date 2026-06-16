## Why

A security and PM audit (June 2026) identified concrete blockers that prevent inviting real users: real secrets sitting in `.env` with a hard-coded dev fallback in code, no input validation at API boundaries, a price-fetch path that one user can use to amplify Yahoo traffic on every other user's behalf, an IMAP poller that can route another user's brokerage confirmations into the wrong profile, no rate limiting on auth, no production sender domain for verification emails, and no error tracking or health endpoint. Until these are fixed the app cannot accept signups from anyone outside the author.

## What Changes

- **BREAKING** Refuse to boot when `BETTER_AUTH_SECRET` or `CRON_SECRET` is missing/empty in production; remove the literal `'dev-secret-change-in-production'` fallback in `src/lib/auth.ts` and reject `"Bearer undefined"` in cron route guards.
- **BREAKING** Every mutating API route validates its request body with `zod` (positive finite numbers for price/quantity, enums for `action`, ISO dates, max string lengths). Invalid input returns `400` with a generic message; the raw error stays server-side.
- Scope `fetchCurrentPrices` and `fetchHistoricalPrices` per-user/profile so `POST /api/prices/fetch` and `POST /api/prices/backfill` no longer touch other users' assets. Gate `/api/prices/backfill` behind `CRON_SECRET` only (no authenticated-user trigger).
- Move global `lastPriceFetch` / `lastRebalanceCheck` / `lastEmailPoll` cooldowns off the singleton `settings` row into a per-user limiter; add `.where(eq(settings.id, 1))` to every legacy `settings` update.
- Disable the IMAP email-poll cron and hide the CMC mapping UI until per-user IMAP/OAuth credentials and proof-of-ownership for CMC account numbers land. Mark the feature as "preview, single-tenant" in `settings` and `import` specs.
- Add file-upload limits to every importer (`5 MB` cap, MIME allowlist) and wrap `mailparser` + `pdf-parse` calls in a `Promise.race` timeout with attachment size caps.
- Enable Better Auth rate limiting on login, password reset, and email verification.
- Require ToS + privacy + disclaimer acknowledgement on signup (checkbox + DB column).
- Switch Resend to a verified production sender domain; refuse to send when only the sandbox key is configured.
- Add a `headers()` block in `next.config.ts` returning HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and a baseline CSP. Verify Better Auth cookies carry `Secure; HttpOnly; SameSite=Lax` in prod.
- Sanitise API error responses: log full error server-side, return `{ error: "Internal error" }` to clients on 5xx. No raw `String(error)` to the wire.
- Wire Sentry (or equivalent) for server + client error capture; add `GET /api/health` returning DB + price-source readiness for uptime monitors.
- Run `npm audit fix`; pin or replace `xlsx@0.18.5` after evaluating CVE exposure.
- Harden `scripts/migrate-to-multiuser.ts`: require `--owner-email`, refuse ambiguous orphan/user mappings, then make `profiles.user_id` NOT NULL.

Out of scope (fast-follow): CGT/franking reporting, Stripe/billing, mobile/responsive overhaul, 2FA/passkeys, native bank aggregation.

## Capabilities

### New Capabilities
- `security-headers`: HTTP response headers, CSP policy, and cookie flag guarantees for all responses.
- `observability`: Error tracking, health-check endpoint, and sanitised error envelopes for the API.
- `input-validation`: Zod schemas at every API trust boundary plus shared validation utilities.

### Modified Capabilities
- `auth`: Boot-time secret validation, rate limiting, ToS-accept on signup, sandbox-Resend refusal.
- `settings`: Remove global cron cooldown columns (or scope per-user), `WHERE` clauses on every singleton update, mark IMAP poller as disabled/preview.
- `prices`: Scope price fetch/backfill per-user/profile; backfill becomes cron-only.
- `cron`: Reject `"Bearer undefined"`; require `CRON_SECRET` boot-time presence; gate price backfill behind cron only.
- `import`: File size + MIME validation on every importer; attachment parse timeouts; disable IMAP-poll-to-any-profile behaviour.
- `profiles`: `user_id` becomes NOT NULL after the migration script hardening.

## Impact

- **Breaking change**: Yes — boot fails without required env vars; API routes reject previously-tolerated payloads; `profiles.user_id` becomes NOT NULL.
- **DB migration**: Yes — drop or scope `settings.last_price_fetch` / `last_rebalance_check` / `last_email_poll`; make `profiles.user_id` NOT NULL; add `user.tos_accepted_at` (or similar) column.
- **New config/env vars**: `SENTRY_DSN` (optional but recommended), production-grade `BETTER_AUTH_SECRET` + `CRON_SECRET`, verified `RESEND_FROM` domain. `IMAP_*` becomes optional and the feature flag stays off in prod.
- **Affected capabilities**: `auth`, `settings`, `prices`, `cron`, `import`, `profiles`, plus three new specs (`security-headers`, `observability`, `input-validation`).
- **Affected code**: `src/lib/auth.ts`, `src/lib/prices.ts`, `src/lib/email-poll.ts`, `src/app/api/**`, `src/app/api/cron/**`, `src/middleware.ts`, `next.config.ts`, `scripts/migrate-to-multiuser.ts`, `src/db/schema.ts`, `src/lib/email.ts`.
- **Dependencies**: add `@sentry/nextjs` (or chosen tracker); run `npm audit fix`; evaluate replacing `xlsx`.
