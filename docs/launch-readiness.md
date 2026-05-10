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
- [ ] **Resend custom domain** with SPF + DKIM + DMARC. The sandbox
      `onboarding@resend.dev` only delivers to your own Resend inbox, so
      real users won't receive verification emails.
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
- [ ] **Decide what to do with the IMAP poller**. The `/api/cron/email`
      handler uses one shared IMAP account and writes to *all* users'
      `cmcAccountMappings`. As shipped, a malicious user could create a
      mapping for a CMC account number that belongs to someone else and
      have their trades imported. Options: remove the feature, gate it
      behind admin-only, or scope IMAP credentials per-user.

### Operational basics
- [ ] **Error monitoring** (Sentry free tier). You will not see prod
      crashes otherwise.
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
