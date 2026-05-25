# ADR 0003 — Single-password auth, no users table

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-03-04 |
| Deciders | (me) |

## Context

The app needs to be password-protected — it's reachable on a LAN and may eventually be reachable through a tunnel or behind a VPN — but it's a single-user app per design. Adding a full identity system (users, sessions, password reset, email verification, RBAC) is heavy for a one-user product and at odds with the privacy thesis.

## Decision

**Single shared password. No users table.** The first password set becomes the password. A bcrypt hash is stored in the singleton `settings` row. Login exchanges password for a 30-day JWT in an HTTP-only cookie. Middleware gates everything except `/login`, `/api/auth`, and `/api/cron`.

## Consequences

**Accepted.**

- Auth code fits on one screen ([`src/lib/auth.ts`](../../src/lib/auth.ts), [`src/middleware.ts`](../../src/middleware.ts), [`src/app/api/auth/route.ts`](../../src/app/api/auth/route.ts)).
- No password reset flow — if you forget the password, you wipe `local.db` and start over. For a personal app where the user owns the device, this is acceptable.
- Multi-profile is decoupled from auth: the cookie-based active profile (see [ADR 0007](./0007-multi-profile-via-cookie.md)) lets one logged-in user toggle between portfolios without touching identity.

**Trade-offs accepted.**

- Cannot have a household where two people log in with separate credentials. They share the password or run separate instances. (Multi-profile gives them separate *portfolios*; the auth boundary is one.)
- No audit trail of who-did-what. There is no "who". For a single-user product, that's correct.
- If a managed-self-host tier ships later, the auth model has to grow. But it grows from "one person logs into one instance" to "one person logs into their own instance" — still no multi-tenant identity inside any single instance.

## Alternatives considered

- **Magic-link email auth.** Avoids password storage entirely. Rejected — adds a hard email dependency for a feature (auth) that should work offline on a Pi.
- **OAuth (Google / GitHub).** Convenient but requires the app to know about a third-party identity provider. Wrong for the privacy-thesis audience.
- **Full users table with bcrypt + sessions.** Standard pattern. Rejected as over-engineered for one user — adds tables, password-reset flow, email verification, etc., none of which earn their keep.
- **No auth at all, rely on network gating.** Considered briefly. Loses the "I can expose this through a tunnel without instantly leaking" property. Cheap insurance to keep the auth.

## Revisit if

- The product becomes multi-user (e.g. a household tier). At that point the model has to extend — likely by keeping one-password-per-instance and adding lightweight identity inside the instance for delegation.
- The OWASP threat model around shared-secret auth shifts (e.g. password-leak class of attacks demands MFA). Adding TOTP would be the smallest delta.
