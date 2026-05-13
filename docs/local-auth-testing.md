# Testing multi-user auth locally

Three paths, in order of how much setup they need.

## 1. Quickest test — sign in as the migrated owner (no third-party setup)

The migration script already created a user from your old single-password
install. You can sign in with your existing password — the bcrypt verifier
handles the legacy hash.

1. Add a Better Auth secret to `.env.local`:

   ```sh
   echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
   echo "BETTER_AUTH_URL=http://localhost:3000" >> .env.local
   echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> .env.local
   ```

2. Start the dev server:

   ```sh
   npm run dev
   ```

3. Open <http://localhost:3000/login> and sign in with `chriz999@gmail.com`
   plus your old password.

That exercises the email/password sign-in path end-to-end.

## 2. Test new sign-ups (verification email via Resend)

Sign-up requires email verification, so you need a Resend key.

1. Grab a free key at <https://resend.com> → API Keys.
2. Either verify a sender domain, or use the sandbox `onboarding@resend.dev`
   (only delivers to the email address on your Resend account).
3. Add to `.env.local`:

   ```sh
   RESEND_API_KEY=re_...
   EMAIL_FROM="Portfolio Tracker <onboarding@resend.dev>"
   ```

4. Restart `npm run dev`, visit <http://localhost:3000/signup>, create an
   account, then click the verification link in the email.

If you'd rather skip Resend during local dev, ask me to add a fallback that
logs the verification URL to the console.

## 3. Test Google OAuth

1. <https://console.cloud.google.com/apis/credentials> → Create OAuth client
   ID → Web application.
2. Authorized redirect URI:
   `http://localhost:3000/api/auth/callback/google`
3. Add to `.env.local`:

   ```sh
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

4. Restart `npm run dev`, click **Continue with Google** on the login page.

## 4. Verify data isolation

1. Sign in as the migrated owner — you should see the existing profiles,
   assets, and transactions.
2. Sign out from `/settings`.
3. Sign up as a second user (use Google or a different email).
4. The new account should see **zero** profiles. Trying to fetch the first
   user's profile by id (e.g. `/api/profiles` with `x-profile-id: 1`) should
   return HTTP 404 — confirms the cross-user guard is on.

## Notes

- The legacy `JWT_SECRET` env var is no longer read by the app; you can leave
  it in `.env.local` or remove it.
- `npm run migrate:multiuser` is idempotent — safe to re-run.
- Production deploys also need `BETTER_AUTH_SECRET` to be 32+ chars and the
  Google redirect URI to point at the prod origin.
