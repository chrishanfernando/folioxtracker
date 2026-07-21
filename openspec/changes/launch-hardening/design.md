## Context

FolioX Tracker is functional as a personal tool but the June 2026 audit surfaced ten concrete issues that block letting external users sign up. They fall into three buckets:

1. **Trust-boundary holes** — no zod validation on API bodies; the `priceAud`, `quantity`, and similar numeric fields flow into the DB as whatever the client sends. File uploads and IMAP attachments parse without size limits or timeouts.
2. **Multi-tenant scope bugs** — `fetchCurrentPrices`/`fetchHistoricalPrices` operate on every active asset across every user, so any authenticated user can amplify Yahoo traffic and trigger writes for assets they don't own. The singleton `settings` row is updated without a `WHERE` clause, and its cron timestamps are used as global cooldowns that one user can starve. The CMC IMAP poller routes attachments by `cmc_account_number` with no ownership proof.
3. **Operational hygiene** — secret fallbacks in code, no rate limiting on auth, no production sender domain for Resend, no security headers, raw `String(error)` returned to clients, no error tracking, no health endpoint.

Constraints to respect while fixing all this:
- Must still run on a Raspberry Pi (low memory, no Sentry self-hosted unless trivial).
- Must not break the existing single-tenant author install — every behavioural change has to either be backwards-compatible at the data layer or accompanied by an idempotent migration.
- Drizzle migrations run on `npm run build`, so all schema changes go through `drizzle-kit generate`.
- Better Auth defaults are the security baseline; we extend rather than replace.

## Goals / Non-Goals

**Goals:**
- App refuses to boot in production without the secrets it actually needs.
- Every mutating API route validates its input at the boundary; clients can no longer corrupt financial integrity by sending malformed bodies.
- One user's actions cannot read, write, or fetch data on behalf of another user. The price-fetch + IMAP-poller cross-tenant paths are closed.
- Auth surfaces (login, password reset, email verification, signup) are rate-limited and require ToS acknowledgement.
- API responses, headers, and cookies meet baseline OWASP expectations for a financial app.
- A single uptime monitor + error tracker can tell us when the app is unhealthy, with no PII in error responses.

**Non-Goals:**
- CGT/franking reporting, dividend forecasting, multi-currency display — fast-follow product work.
- Stripe / billing / paid tiers — defer until the waitlist tells us what to charge for.
- 2FA, passkeys, active-sessions list — desirable but post-MVP.
- Mobile-responsive overhaul of `/holdings` and `/transactions` — tracked separately.
- Replacing better-auth, Drizzle, or Yahoo Finance.
- Per-user IMAP/OAuth credentials for the email-poll feature. The IMAP path is *disabled in prod* and the design treats it as a preview feature, not a hardening target for this change.

## Decisions

### D1. Boot-time env validation via a `src/lib/env.ts` zod schema

Instead of scattering `process.env.X ?? "dev-fallback"` reads through the codebase, parse `process.env` once at module load with a zod schema that:
- Requires `BETTER_AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM` when `NODE_ENV === "production"`.
- Allows `IMAP_*` only when `EMAIL_POLL_ENABLED === "true"`; otherwise leaves them undefined and the cron route 503s.
- Throws a single readable error on boot if anything is missing.

Alternative considered: keeping the fallbacks but gating them on `NODE_ENV !== 'production'`. Rejected because a misconfigured prod deploy (forgetting to set `NODE_ENV=production`) would silently re-enable the dev secret. Hard-fail on missing prod env is the safer default and is one grep away from auditable.

### D2. Zod schemas live next to the routes, plus shared primitives in `src/lib/validation/`

Each `src/app/api/<resource>/route.ts` exports (or imports) a `Schema` for its POST/PATCH body. Shared primitives — `aud`, `qtyDecimal`, `isoDate`, `actionEnum`, `sanitizedString(maxLen)` — live in `src/lib/validation/primitives.ts` so we don't redefine `z.number().positive().finite()` ten times.

Errors return `{ error: "Invalid request" }` with `status: 400`. The zod issue list is logged server-side with a request id but not returned. Rationale: leaking field-level errors to unauthenticated callers can aid enumeration; authed callers don't need them either because the UI builds the same schema with `react-hook-form`.

Alternative considered: a single shared `validateBody(schema)` helper that wraps every handler. Rejected on first pass because it obscures the per-route surface; revisit if the boilerplate piles up.

### D3. Per-profile scoping for price fetch + cron-only backfill

`fetchCurrentPrices(profileId)` takes a required `profileId`, joins `assets` by that profile, and returns only those rows. `POST /api/prices/fetch` derives the active profile via `src/lib/profile.ts` and calls into the scoped function. `fetchHistoricalPrices` (backfill) moves entirely behind `CRON_SECRET` — the user-facing route is removed, and the cron job iterates profiles serially with a small sleep between to stay under Yahoo's rate limit.

Alternative considered: keep `/api/prices/backfill` authed but check ownership. Rejected because backfill is expensive (2y weekly + daily) and we don't want any user button-mashing it. Cron-only with explicit "trigger backfill for me" written into the spec as a future feature.

### D4. Drop the global cooldown columns; add a per-user in-memory limiter for price fetch

`settings.last_price_fetch`, `last_rebalance_check`, `last_email_poll` are removed from `settings` and replaced with:
- A per-user in-memory `Map<userId, lastFetchAt>` with a 1-minute cooldown for `POST /api/prices/fetch`. Cheap, RPi-friendly, lost on restart (acceptable).
- For cron, persist last-run timestamps in a new `cron_runs` table keyed by `job_name`, not on the user-facing `settings` row.

Alternative considered: Redis or DB-backed rate limit. Rejected for v1 — single-instance deploys don't need it and the RPi constraint pushes us away from Redis.

### D5. Better Auth rate-limit block + ToS acknowledgement

Enable Better Auth's built-in `rateLimit` plugin with conservative defaults (10 attempts / 15 min per IP for login + reset). Add a `tosAcceptedAt: timestamp NOT NULL` column to the `user` table via Better Auth's `additionalFields` hook (or a sibling `user_tos` table to avoid touching the auth schema). The signup form requires a checkbox; the server-side hook on `signUp.email` rejects when the flag is absent.

Alternative considered: writing our own rate limiter. Rejected — Better Auth already has one and we don't want to maintain our own session-aware limiter.

### D6. Resend production domain enforced; sandbox refusal

`src/lib/email.ts` reads `RESEND_FROM` from validated env. If `NODE_ENV === "production"` and the sender domain matches `*.resend.dev` or is missing, every send throws `EmailMisconfiguredError` instead of silently delivering nothing. Verification emails are blocking — the user is told to retry after support fixes config.

### D7. Security headers via `next.config.ts` `headers()`

Static header policy applied to all routes:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy`: starts in **report-only** mode for the first release with `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://query1.finance.yahoo.com https://*.sentry.io` and a `report-uri` to Sentry's CSP endpoint. After two weeks of clean reports, flip to enforcing.

Cookies: rely on Better Auth's defaults; add an integration check on `/api/health` that inspects the freshly-issued cookie flags.

Alternative considered: enforcing CSP from day one. Rejected because Next 16 inlines some bootstrap scripts and recharts injects styles; we want a measurement period.

### D8. Sentry for both server and client; `/api/health` for liveness

Adopt `@sentry/nextjs`. Server-side captures unhandled rejections + `withSentry`-wrapped route handlers. Client-side captures unhandled errors and the user id (no email).

`GET /api/health` returns `{ ok: true, db: "ok", prices: "ok"|"degraded", buildSha }` with status 200 if DB ping succeeds, 503 otherwise. No auth required so UptimeRobot can hit it; no sensitive info in the body.

Alternative considered: self-hosted Glitchtip on the Pi. Rejected for v1 — adds operational surface; revisit if Sentry quotas bite.

### D9. Error response sanitiser

Add a `src/lib/api-error.ts` helper that converts any caught error into a stable envelope:
- Known `AppError` subclasses (`ValidationError`, `NotFoundError`, `ForbiddenError`) → their declared status + a safe `message`.
- Anything else → `{ error: "Internal error" }` + `status: 500`, with the underlying error captured to Sentry under a `request_id` that's also returned in the response header `x-request-id` for support.

Every API route's catch becomes `return apiError(error, request)`. ESLint rule (or grep CI) forbids `String(error)` and `error.message` in route handlers.

### D10. `migrate-to-multiuser.ts` hardening + `profiles.user_id` NOT NULL

The script gains:
- Required `--owner-email <addr>` argument; the script looks up the user, refuses if not found.
- Refuses to run when more than one user exists *and* `--owner-email` isn't passed.
- Prints a dry-run by default; requires `--commit` to actually write.
- After a successful run, a follow-on migration sets `profiles.user_id NOT NULL` and adds a CHECK constraint.

Existing single-tenant installs in the wild (just the author's) re-run the script with `--owner-email` and then accept the NOT NULL migration.

### D11. File-upload + attachment limits

Every `formData.get("file")` callsite validates:
- `file.size <= 5 * 1024 * 1024` (5 MB) — reject 413.
- `file.type` in source-specific allowlist (`text/csv`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/pdf`).

For IMAP `simpleParser` + `pdf-parse`, wrap each call in `Promise.race([parse, timeout(10_000)])` and skip the message on timeout. Attachment buffers larger than 5 MB are dropped before parsing.

## Risks / Trade-offs

- **CSP report-only delay** → Mitigation: ship as report-only for two weeks with Sentry collecting reports; flip to enforcing in a follow-up PR once the report stream is empty for 48h.
- **In-memory rate limit lost on restart** → Mitigation: acceptable for a single-instance deploy; document in the spec; revisit if we go multi-instance.
- **NOT NULL on `profiles.user_id` breaks if the migration script wasn't run** → Mitigation: drizzle migration runs `SELECT count(*) FROM profiles WHERE user_id IS NULL` first and aborts with a clear message instructing to run the script.
- **Sentry adds bundle size + a third-party SaaS** → Mitigation: optional via `SENTRY_DSN`. If unset, error tracking degrades to server logs only and `apiError` still sanitises.
- **Zod everywhere adds ~5-10% to bundle on routes that import it** → Mitigation: zod is already a dependency for form validation; tree-shaking + Next 16 keeps the cost flat. Acceptable.
- **Disabling IMAP feature flag may frustrate the one user (the author) who relied on it** → Mitigation: documented in proposal; manual CSV import still works; per-user IMAP is on the fast-follow list.

## Migration Plan

1. **Phase 1 — code-only** (no schema change): env validation, zod on API routes, error sanitiser, security headers, Better Auth rate limit, Resend sandbox refusal, file-upload limits. Deploy and verify.
2. **Phase 2 — drizzle migration**: add `cron_runs` table, drop the three legacy `settings` cooldown columns (after Phase 1 deploy proves nothing reads them), add `user.tos_accepted_at`.
3. **Phase 3 — observability**: wire Sentry, ship `/api/health`, point UptimeRobot at it.
4. **Phase 4 — migrate-to-multiuser hardening**: ship the hardened script, run it against the author's install, then ship the `profiles.user_id NOT NULL` migration.
5. **Phase 5 — IMAP shutoff**: set `EMAIL_POLL_ENABLED=false` in prod, remove CMC-mappings UI from `/settings`.
6. **Rollback**: each phase is its own PR with its own revert path. The drizzle migrations are forward-only; rollback for those means restoring from Turso PITR.

## Open Questions

- Do we adopt Sentry or pick a lighter alternative (Highlight, Glitchtip)? Going with Sentry for now; revisit if cost is an issue.
- Where does `RESEND_FROM` actually point? Needs a real domain with verified DNS — operational, not a code question, but ship-blocker.
- Do we want Turso PITR confirmed before flipping signup public? Yes — track as ops task.
