# Public-launch readiness

What's left before we open signups beyond the migrated owner. Ordered by
risk, not effort.

## Must-haves (block launch)

### Legal & user rights
- [ ] **"Not financial advice" disclaimer** on dashboard + footer.
- [ ] **Terms of Service** + **Privacy Policy** pages, linked from signup.
- [ ] **Account deletion** — `/settings` → Delete account, cascades user +
      profiles + assets + transactions. Required for AU/GDPR compliance.
- [ ] **Data export** — CSV/JSON of holdings + transactions. Same regulatory
      reason.

### Security gaps from the auth migration
- [x] **Resend custom domain** — DONE 2026-07-22. Verified on apex
      `folioxtracker.com` (DKIM + SES return-path in DNS); prod `EMAIL_FROM`
      = `no-reply@folioxtracker.com`. SPF + DKIM live; **DMARC still to add**
      (`_dmarc.folioxtracker.com`, `p=none`) — nice-to-have, not a blocker.
- [ ] **Rate limiting** in Better Auth (`rateLimit: { enabled: true,
      window: 60, max: 10 }` in `src/lib/auth.ts`). Login/signup is
      brute-forceable today.
- [ ] **Stronger password policy** — bump `minPasswordLength` to 10, reject
      common passwords.
- [ ] **Production env validation** — fail fast at boot if
      `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, etc. are missing or still
      placeholder values. Use a small `zod` schema.
- [ ] **Cookie security** — confirm `secure: true` and `sameSite: 'lax'`
      in production.
- [ ] **Patch `npm audit` highs** — 6 high vulnerabilities reported on
      install. At minimum patch those before launch.
- [x] **Decide what to do with the IMAP poller** — DECIDED 2026-07-22:
      **keep disabled at launch.** Verified `EMAIL_POLL_ENABLED=false` in
      production (settings endpoint returns `emailPollEnabled: false`), so the
      cron poller and all CMC-mapping endpoints are off — no cross-user
      exposure. Hardening added in Phase 3 (feature flag; per-profile
      ownership check on verify; only `verified` mappings ingest) narrows the
      original risk, but **before this is ever enabled** fix the remaining
      hole: the verify route
      (`src/app/api/settings/cmc-accounts/[id]/verify/route.ts`) accepts any
      PDF that merely *contains* a 6+ digit number matching the mapping — the
      document isn't validated as a genuine CMC confirmation, so proof of
      ownership is **forgeable** by anyone who knows a victim's CMC account
      number. Real fix: per-user IMAP credentials, or non-forgeable
      verification. Tracked as a post-launch item.

### Operational basics
- [x] **Error monitoring** — DONE 2026-07-22. Sentry (US region) live and
      verified; client events tunnel through `/monitoring` to survive ad
      blockers. See TODO.md §1.
- [ ] **Real production secrets** — `CRON_SECRET` and `BETTER_AUTH_SECRET`
      rotated to long random values before launch. The `.env.example`
      still says "change-this-…".
- [ ] **Backups** — confirm Turso point-in-time recovery is enabled.
- [ ] **Support email** on the site so users can reach you when something
      breaks (`support@yourdomain` or similar).

## Could-haves (first month)

- [ ] Welcome email after verification.
- [ ] Empty-state + onboarding for new users (today the dashboard is blank
      until they create a portfolio + import).
- [ ] In-app profile rename/delete (API supports it, UI doesn't expose it).
- [ ] "Log out from all devices" using Better Auth `revokeSessions`.
- [ ] CAPTCHA on signup (Cloudflare Turnstile, free) — stops bot signups
      consuming the Resend quota.
- [ ] Forgot-password rate limit + lockout after N failed attempts.
- [ ] Uptime monitor (UptimeRobot free) pinging `/api/health` (endpoint
      doesn't exist yet — add it).
- [ ] **Multi-currency support** — today everything is AUD. Even labelling
      the app "AUD-only beta" is enough for v1.
- [ ] Privacy-friendly analytics (Plausible or PostHog).
- [ ] Mobile layout fixes for `/holdings` and `/transactions`.

## Nice-to-haves

- [ ] 2FA / passkeys (Better Auth plugins).
- [ ] Active-sessions list page.
- [ ] Changelog / release notes page.
- [ ] Demo / read-only sample portfolio for marketing.
- [ ] In-app feedback widget.
- [ ] Public status page (BetterStack, Statuspage).
- [ ] Per-user storage / API quotas if abuse becomes a problem.
- [ ] Yahoo Finance fallback (the unofficial API breaks; consider a paid
      provider as backup).

## This week's focus

1. Account deletion + data export (this branch).
2. Resend custom domain with SPF/DKIM/DMARC.
3. Better Auth rate limiting + Sentry.
4. Decide on the IMAP poller (remove vs. admin-gate vs. per-user
   credentials).
5. Disclaimer + ToS + Privacy pages.
