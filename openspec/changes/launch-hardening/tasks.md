## 1. Env validation + boot-time guards

- [x] 1.1 Create `src/lib/env.ts` with a zod schema parsing `process.env` once at module load (required vars in prod: `BETTER_AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `BETTER_AUTH_URL`; optional: `SENTRY_DSN`, `EMAIL_POLL_ENABLED`, `IMAP_*`).
- [x] 1.2 Export typed `env` object; throw `EnvValidationError` with all missing/invalid keys when `NODE_ENV === "production"`.
- [x] 1.3 In dev, generate a random `BETTER_AUTH_SECRET` per process and log a single warning if not set.
- [x] 1.4 Replace every `process.env.X ?? "..."` fallback in `src/lib/auth.ts`, `src/lib/email.ts`, `src/lib/email-poll.ts`, `src/app/api/cron/**` with reads from `env`.
- [x] 1.5 Remove the literal `"dev-secret-change-in-production"` fallback from `src/lib/auth.ts:54`.
- [x] 1.6 Make cron route guards reject when `env.CRON_SECRET` is empty even if the request header matches `"Bearer undefined"`.
- [x] 1.7 Manual smoke: prod boot with empty `BETTER_AUTH_SECRET` fails with readable message; prod boot with `EMAIL_FROM=*.resend.dev` fails; dev boot generates random secret with warning. (Cron 401 path also covered by the new `checkCronSecret` helper short-circuit when `env.CRON_SECRET` is empty.)

## 2. Shared validation primitives + error envelope

- [x] 2.1 Create `src/lib/validation/primitives.ts` exporting `aud`, `qtyDecimal`, `isoDate`, `transactionAction`, `sanitizedString(maxLen)`, `positiveInt`, `assetIdRef`.
- [x] 2.2 Create `src/lib/api-error.ts` exporting `AppError`, `ValidationError`, `ForbiddenError`, `NotFoundError`, and an `apiError(error, request)` helper that returns the sanitised envelope `{ error, requestId }` with the appropriate status.
- [x] 2.3 The `apiError` helper attaches `x-request-id` to the response and logs the underlying error (and captures to Sentry when DSN is set) with that id.
- [x] 2.4 Add an ESLint rule (or a `scripts/lint-route-errors.ts` grep check) that fails on `String(error)`, `error.message`, `${error}` inside `NextResponse.json(...)` calls in `src/app/api/**/route.ts`.

## 3. Zod schemas on every mutating route

- [x] 3.1 `POST /api/transactions` — schema for body; replace destructured raw fields with parsed result; route through `apiError`.
- [x] 3.2 `PATCH /api/transactions/[txId]` — same.
- [x] 3.3 `DELETE /api/transactions/[txId]` — schema for id param only.
- [x] 3.4 `POST /api/assets`, `PATCH /api/assets/[id]` — schemas.
- [x] 3.5 `POST /api/profiles`, `PATCH /api/profiles` — schemas (`name` ≤ 64).
- [x] 3.6 `POST /api/holdings/[id]/close` — schema enforcing `priceAud >= 0`, finite.
- [x] 3.7 `POST /api/risk-profile` — schema for the questionnaire answers.
- [x] 3.8 `PUT /api/settings` and CMC mapping CRUD — schemas; sanitise label length.
- [~] 3.9 `POST /api/category-targets`, `PATCH /api/category-targets/[id]` — folded into `/api/rebalance` POST (no separate routes exist; targets are managed via the rebalance endpoint).
- [x] 3.10 `POST /api/rebalance` mutating routes — schemas where applicable.
- [x] 3.11 Add `scripts/check-route-validation.ts` that walks `src/app/api/**/route.ts`, asserts every JSON-body route imports zod and validates before DB writes; also fails on raw error strings.

## 4. Per-user + per-profile scoping of price fetch

- [x] 4.1 Change `fetchCurrentPrices` in `src/lib/prices.ts` to take a required `profileId` and select only assets where `profile_id = profileId AND is_active = true`.
- [x] 4.2 Change `fetchHistoricalPrices` to take a `profileId` plus an asset filter, with the same scoping.
- [x] 4.3 Update `POST /api/prices/fetch` to resolve the active profile via `src/lib/profile.ts`, then call `fetchCurrentPrices(activeProfileId)`.
- [x] 4.4 Replace the global `settings.lastPriceFetch` cooldown with an in-memory `Map<userId, lastFetchAt>` (60 s) in `src/lib/rate-limit.ts`; return 429 when exceeded.
- [x] 4.5 Delete `src/app/api/prices/backfill/route.ts` (user-facing). Return HTTP 410 from a stub if the path still routes.
- [x] 4.6 Add `src/app/api/cron/prices/backfill/route.ts` gated by `CRON_SECRET`; iterate profiles serially with a 250 ms sleep between Yahoo calls; record into `cron_runs`.
- [x] 4.7 Update `/api/cron/prices` (`src/app/api/cron/prices/route.ts`) to iterate profiles and call the scoped fetcher for each.

## 5. Settings hygiene + cron_runs

- [x] 5.1 Add `WHERE` clauses (`.where(eq(settings.id, 1))`) to every `db.update(settings).set(...)` call (audit `src/lib/prices.ts`, `src/lib/email-poll.ts`, `src/lib/rebalance.ts`, route handlers). *(Satisfied: all three legacy writers now write to `cron_runs` instead; no remaining settings UPDATEs in `src/`.)*
- [x] 5.2 Drizzle migration: create `cron_runs` table with `job_name PK`, `last_run_at`, `last_status`, `last_summary` (JSON text).
- [x] 5.3 Drizzle migration: drop columns `last_price_fetch`, `last_rebalance_check`, `last_email_poll` from `settings`.
- [x] 5.4 Update `GET /api/settings` to stop returning the dropped columns; add `GET /api/cron/status` returning the `cron_runs` rows.
- [x] 5.5 Update the `/settings` page to read cron status from the new endpoint.

## 6. IMAP feature flag + CMC mapping verification

- [x] 6.1 Add `EMAIL_POLL_ENABLED` to `src/lib/env.ts`; default `"false"`.
- [x] 6.2 In `src/app/api/cron/email/route.ts`, short-circuit with `{ skipped: "feature disabled" }` when the flag is not `"true"`.
- [x] 6.3 Drizzle migration: add `verified BOOLEAN NOT NULL DEFAULT 0` to `cmc_account_mappings`; backfill all existing rows to `false`.
- [x] 6.4 Add `POST /api/settings/cmc-accounts/[id]/verify` accepting a PDF whose embedded account number must match the mapping; sets `verified = true`.
- [x] 6.5 Update `src/lib/email-poll.ts` to only ingest into a profile whose mapping has `verified = true`; otherwise leave unread and record skip.
- [x] 6.6 Wrap `simpleParser(msg.source)` and `pdf(attachment.content)` calls in `Promise.race([..., timeout(10_000)])`; skip with error on timeout.
- [x] 6.7 Cap attachment buffer length to 5 MB; cap raw message source to 20 MB; skip oversized messages.
- [x] 6.8 Hide the CMC mappings UI in `src/app/(authed)/settings/page.tsx` when the feature flag is off; API routes return 503.

## 7. File-upload validation

- [ ] 7.1 Create `src/lib/uploads.ts` with `assertSafeUpload(file, { maxBytes, mimeAllowlist })`.
- [ ] 7.2 Apply to `POST /api/import`, `/api/import/cmc`, `/api/import/stake`, `/api/import/swyftx`, `/api/import/ir` with the source-appropriate allowlist (CSV / XLSX / PDF).
- [ ] 7.3 Return HTTP 413 / 415 with the sanitised envelope; do not parse on failure.

## 8. Better Auth rate limiting + ToS acknowledgement

- [ ] 8.1 Enable Better Auth's built-in rate limit in `src/lib/auth.ts`: login 10/15min/IP, password-reset 5/15min/IP, verification resend 5/15min/IP.
- [ ] 8.2 Drizzle migration: add `tos_accepted_at` (datetime, nullable initially) to `user`; backfill existing rows to current timestamp; follow-on migration sets NOT NULL.
- [ ] 8.3 Wire Better Auth `additionalFields` (or `beforeSignUp` hook) to require `tosAccepted: true` on credential sign-up; reject HTTP 400 otherwise.
- [ ] 8.4 Add the ToS / Privacy / Disclaimer checkbox to `src/app/signup/page.tsx`; form submits `tosAccepted` and disables submit unless checked.
- [ ] 8.5 Add `POST /api/account/accept-tos` for the Google OAuth interstitial path.
- [ ] 8.6 Add `/welcome` route (server component) that prompts ToS acceptance; redirect there from middleware when `tos_accepted_at IS NULL` and the route is not `/welcome`, `/api/account/accept-tos`, `/api/auth/*`, or the data export/delete routes.

## 9. Resend production domain

- [ ] 9.1 In `src/lib/env.ts`, validate that `EMAIL_FROM`'s domain is not in `*.resend.dev` when `NODE_ENV === "production"`.
- [ ] 9.2 In `src/lib/email.ts`, refuse to send (throw `EmailMisconfiguredError`) when the domain is the sandbox; emit a single boot warning in dev if so.
- [ ] 9.3 Operational: configure DNS for the chosen sender domain, verify in Resend (tracked outside code).

## 10. Security headers + cookie audit

- [ ] 10.1 Add a `headers()` function in `next.config.ts` returning HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and the report-only CSP described in design D7.
- [ ] 10.2 Add a CSP report endpoint (`/api/csp-report`) that forwards reports to Sentry (or logs when DSN is unset).
- [ ] 10.3 Confirm Better Auth issues cookies with `HttpOnly; Secure; SameSite=Lax` in prod; codify the check inside `/api/health` (see §11).
- [ ] 10.4 Manual: launch in prod build, confirm headers via `curl -I https://<host>/`.

## 11. Observability — Sentry + /api/health

- [ ] 11.1 `npm install @sentry/nextjs`; add `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`; gate init on `env.SENTRY_DSN`.
- [ ] 11.2 Hook the `apiError` helper to call `Sentry.captureException(error, { tags: { route, method }, contexts: { request: { requestId } } })`.
- [ ] 11.3 Configure Sentry `beforeSend` to strip request bodies, headers, and cookies; only HTTP method + route + status are allowed.
- [ ] 11.4 Add `GET /api/health` returning `{ ok, db, prices, cookies, buildSha, uptime }`; DB ping is `SELECT 1`; price freshness is read from `cron_runs.prices.last_run_at`.
- [ ] 11.5 Make `/api/health` public in `src/middleware.ts` allowlist.
- [ ] 11.6 Operational: point UptimeRobot at the health endpoint (tracked outside code).

## 12. migrate-to-multiuser script hardening + profiles.user_id NOT NULL

- [ ] 12.1 Update `scripts/migrate-to-multiuser.ts` to accept `--owner-email <addr>` and `--commit`; dry run by default.
- [ ] 12.2 Refuse to run with `--commit` unless `--owner-email` is provided and resolves to exactly one user.
- [ ] 12.3 Remove the "single existing user" implicit fallback; orphan profiles are only assigned to the explicitly-named owner.
- [ ] 12.4 Drizzle migration: pre-check `SELECT count(*) FROM profiles WHERE user_id IS NULL` and abort with a readable error if non-zero.
- [ ] 12.5 Drizzle migration: alter `profiles.user_id` to NOT NULL; update `src/db/schema.ts` to drop the `.nullable()` modifier.
- [ ] 12.6 Run the script against the author's install with `--owner-email` then `--commit`; then run `npm run db:migrate`.

## 13. Dependency hygiene

- [ ] 13.1 Run `npm audit fix` for the better-auth and nodemailer high-severity advisories; commit lockfile.
- [ ] 13.2 Evaluate replacing `xlsx@0.18.5` with `@e965/xlsx` or a maintained fork; if keeping, add a CI note about the known CVEs.
- [ ] 13.3 Confirm `local.db` is git-ignored; rotate it out of the working tree before any push if present.

## 14. Secret rotation (operational)

- [ ] 14.1 Rotate `RESEND_API_KEY`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (operator action; documented but not code).
- [ ] 14.2 Generate fresh `CRON_SECRET` and update Vercel + cron schedulers.
- [ ] 14.3 Remove any real secrets from `.env.local` before commit; ensure `.env*` ignore patterns are intact.

## 15. Verification

- [ ] 15.1 `npm run lint` clean.
- [ ] 15.2 `tsc --noEmit` clean.
- [ ] 15.3 `scripts/check-route-validation.ts` clean.
- [ ] 15.4 Manual: sign up as a new user end-to-end (signup → ToS check → email verify → first profile created → risk-profile gate → dashboard).
- [ ] 15.5 Manual: confirm second user cannot trigger price fetches that write under user 1's assets (use two browser sessions + DB inspection).
- [ ] 15.6 Manual: `curl /api/health` returns 200 with sane body; uptime monitor configured.
- [ ] 15.7 Manual: `curl -I https://<host>/` shows all security headers and the report-only CSP.
- [ ] 15.8 Manual: rate-limit kicks in after 10 bad logins from one IP within 15 minutes.
- [ ] 15.9 Manual: file upload > 5 MB returns 413; non-PDF / non-CSV / non-XLSX returns 415.
- [ ] 15.10 Manual: CMC mapping create then verify flow; IMAP feature flag stays off in prod for now.
- [ ] 15.11 Confirm `openspec validate launch-hardening --strict` passes.
