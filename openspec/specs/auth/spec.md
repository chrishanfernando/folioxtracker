# Auth Specification

## Purpose

Provide multi-user authentication on top of [Better Auth](https://better-auth.com),
backed by Drizzle/SQLite. Two methods are enabled: email + password (with email
verification) and Google OAuth. Each user owns their own profiles, assets, and
transactions; data is never shared across users. Sessions are stored in the
database and presented as a signed cookie.

## Requirements

### Requirement: Sign-up — email + password
The system SHALL allow any visitor to create an account with email + password,
subject to email verification.

#### Scenario: Successful sign-up
- **GIVEN** the email is not associated with an existing user
- **WHEN** a client `POST /api/auth/sign-up/email` with `{ email, password, name }`
- **AND** the password is at least 8 characters
- **THEN** a `user` row is inserted with `emailVerified=false`
- **AND** an `account` row with `providerId="credential"` and a scrypt password hash is inserted
- **AND** a verification email is sent via Resend
- **AND** the response is HTTP 200 (no session cookie until the email is verified)

#### Scenario: Sign-up with an email that already exists
- **WHEN** a client signs up with a previously-registered email
- **THEN** Better Auth returns the standard error response and no new user is created

### Requirement: Sign-up — Google OAuth
The system SHALL allow any visitor to register or sign in via Google OAuth.

#### Scenario: First-time Google sign-in
- **GIVEN** the Google account email is not associated with an existing user
- **WHEN** a client completes the Google OAuth callback
- **THEN** a `user` row is inserted with `emailVerified=true`
- **AND** an `account` row with `providerId="google"` is inserted
- **AND** a session cookie is issued

### Requirement: Email verification
The system SHALL require email verification before a credential user can sign in.

#### Scenario: Sign-in attempted before verification
- **WHEN** an unverified credential user attempts to sign in
- **THEN** the response carries `error.code="EMAIL_NOT_VERIFIED"` and no session is created

#### Scenario: Verification link clicked
- **WHEN** the user opens the verification URL with a valid token
- **THEN** `user.emailVerified` is set to `true`
- **AND** the user is auto-signed-in (`autoSignInAfterVerification: true`)

### Requirement: Password reset
The system SHALL allow a credential user to reset their password by email.

#### Scenario: Request reset
- **WHEN** a client `POST /api/auth/forget-password` with `{ email, redirectTo }`
- **THEN** a password-reset email is sent via Resend if the user exists
- **AND** the response is HTTP 200 regardless (to avoid enumeration)

#### Scenario: Complete reset
- **WHEN** a client `POST /api/auth/reset-password` with `{ token, newPassword }`
- **AND** the token is valid and unexpired
- **THEN** the credential `account.password` is replaced with a fresh scrypt hash

### Requirement: Sessions and route protection
The system SHALL block unauthenticated access to all routes except an explicit allowlist.

#### Scenario: Public paths bypass auth
- **GIVEN** a request to `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/api/auth/*`, `/api/cron/*`, or `/api/prices/cron`
- **WHEN** the middleware runs
- **THEN** the request is forwarded without checking for a session

#### Scenario: Missing session on a protected page route
- **GIVEN** a request to any other route under `/`
- **AND** no Better Auth session cookie is present
- **THEN** the response is a 307 redirect to `/login`

#### Scenario: Missing session on a protected API route
- **GIVEN** a request to a non-public `/api/*` route
- **AND** no Better Auth session cookie is present
- **THEN** the response is `{ error: "Unauthorized" }` with HTTP 401

### Requirement: Data ownership
The system SHALL scope every read and write to data owned by the authenticated user.

#### Scenario: Listing profiles
- **GIVEN** an authenticated user with id `U`
- **WHEN** the client `GET /api/profiles`
- **THEN** the response includes only profiles where `user_id = U`

#### Scenario: Reading another user's data by id
- **GIVEN** profile `P` is owned by user `U₁`
- **AND** user `U₂` is signed in
- **WHEN** `U₂` makes a request that targets `P` (header `x-profile-id: P` or via an asset/tx that lives under `P`)
- **THEN** the response is `{ error: "..." }` with HTTP 404

### Requirement: Legacy bcrypt support
The system SHALL accept legacy bcrypt password hashes during sign-in so existing
single-password installations migrate without forcing a password reset.

#### Scenario: Owner promoted from settings.passwordHash
- **GIVEN** the owner's `account.password` was seeded from `settings.password_hash` (bcrypt)
- **WHEN** the owner signs in with their original password
- **THEN** the verifier detects the bcrypt prefix and verifies via `bcryptjs.compare`
- **AND** the session cookie is issued normally

### Requirement: Configuration
The system SHALL load `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM` from the environment.
Production deployments MUST set all of these. The fallback values exist for local
development only.
