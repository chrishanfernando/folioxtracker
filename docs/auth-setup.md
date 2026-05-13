# Auth setup

Portfolio Tracker uses [Better Auth](https://better-auth.com) for multi-user
authentication. Two methods are enabled:

- Email + password (with email verification via Resend)
- Google OAuth

## Required environment variables

See `.env.example`. The minimum needed in any environment:

- `BETTER_AUTH_SECRET` — random string, e.g. `openssl rand -base64 32`
- `BETTER_AUTH_URL` — public origin, e.g. `https://portfolio.example.com`
- `NEXT_PUBLIC_APP_URL` — same value as `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — see Google setup below
- `RESEND_API_KEY` — used to send verification and password-reset emails
- `EMAIL_FROM` — verified sender, e.g. `Portfolio Tracker <hello@example.com>`

## Google OAuth setup

1. Go to https://console.cloud.google.com/apis/credentials.
2. Create an OAuth 2.0 Client ID, application type **Web application**.
3. Add an authorized redirect URI:
   `${BETTER_AUTH_URL}/api/auth/callback/google`
   (e.g. `http://localhost:3000/api/auth/callback/google` for dev).
4. Copy the client ID and secret into `.env.local`.

## Migrating from the legacy single-password installation

Run once after deploying the new code against an existing database:

```sh
OWNER_EMAIL=you@example.com npm run migrate:multiuser
```

This creates a single user from your existing `settings` row, attaches all
existing profiles/assets/transactions to that user, and lets you sign in with
your old password. The verifier accepts both bcrypt (legacy) and scrypt (new)
hashes, so the password keeps working unchanged.

## Local dev

```sh
cp .env.example .env.local
# fill in BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, RESEND_API_KEY
npm run dev
```

Visit `/signup` to create an account. The verification link will be sent via
Resend; in development you can also read it from your Resend dashboard.
