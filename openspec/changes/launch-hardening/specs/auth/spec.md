## MODIFIED Requirements

### Requirement: Sign-up — email + password
The system SHALL allow any visitor to create an account with email + password,
subject to email verification, ToS acknowledgement, and per-IP rate limiting.

#### Scenario: Successful sign-up
- **GIVEN** the email is not associated with an existing user
- **WHEN** a client `POST /api/auth/sign-up/email` with `{ email, password, name, tosAccepted: true }`
- **AND** the password is at least 8 characters
- **THEN** a `user` row is inserted with `emailVerified=false` and `tosAcceptedAt` set to the current ISO timestamp
- **AND** an `account` row with `providerId="credential"` and a scrypt password hash is inserted
- **AND** a verification email is sent via Resend
- **AND** the response is HTTP 200 (no session cookie until the email is verified)

#### Scenario: Sign-up without ToS acknowledgement
- **WHEN** a client `POST /api/auth/sign-up/email` with `tosAccepted` missing or `false`
- **THEN** the response is HTTP 400 with `{ error: "Terms of service must be accepted" }`
- **AND** no `user` or `account` row is inserted

#### Scenario: Sign-up with an email that already exists
- **WHEN** a client signs up with a previously-registered email
- **THEN** Better Auth returns the standard error response and no new user is created

### Requirement: Sign-up — Google OAuth
The system SHALL allow any visitor to register or sign in via Google OAuth.
First-time Google sign-up SHALL record ToS acknowledgement on the consent screen
or via a one-time post-OAuth interstitial.

#### Scenario: First-time Google sign-in
- **GIVEN** the Google account email is not associated with an existing user
- **WHEN** a client completes the Google OAuth callback
- **THEN** a `user` row is inserted with `emailVerified=true` and `tosAcceptedAt = null`
- **AND** the user is redirected to `/welcome` (a ToS-accept interstitial) on next request
- **AND** the session cookie is issued
- **AND** every protected route is blocked until `tosAcceptedAt` is set via `POST /api/account/accept-tos`

### Requirement: Configuration
The system SHALL load `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM` from the environment.
Production deployments MUST set all of these. The application SHALL refuse to
boot in production when any required value is missing or empty. There is no
hard-coded fallback secret.

#### Scenario: Missing BETTER_AUTH_SECRET in production
- **GIVEN** `NODE_ENV === "production"` and `BETTER_AUTH_SECRET` is missing or an empty string
- **WHEN** the Next.js process starts
- **THEN** the process exits non-zero with a readable error naming the missing variable
- **AND** the application does not serve any request

#### Scenario: Missing CRON_SECRET in production
- **GIVEN** `NODE_ENV === "production"` and `CRON_SECRET` is missing or an empty string
- **WHEN** the Next.js process starts
- **THEN** the process exits non-zero before serving requests

#### Scenario: Development boot with missing vars
- **GIVEN** `NODE_ENV !== "production"` and `BETTER_AUTH_SECRET` is missing
- **WHEN** the dev server starts
- **THEN** a generated random secret is used for the lifetime of the process and a warning is logged
- **AND** the warning explicitly notes that this fallback does not apply in production

## ADDED Requirements

### Requirement: Auth rate limiting
The system SHALL rate-limit authentication endpoints by IP address to make
credential-stuffing and brute-force attacks impractical.

#### Scenario: Repeated failed login from one IP
- **GIVEN** the same IP has submitted 10 failed `POST /api/auth/sign-in/email` requests within 15 minutes
- **WHEN** the 11th request arrives within the window
- **THEN** the response is HTTP 429 with `{ error: "Too many requests" }`
- **AND** no password verification is performed for that request

#### Scenario: Password-reset enumeration
- **GIVEN** the same IP has submitted 5 `POST /api/auth/forget-password` requests within 15 minutes
- **WHEN** the 6th request arrives within the window
- **THEN** the response is HTTP 429
- **AND** no reset email is dispatched for that request

#### Scenario: Successful request inside the limit
- **WHEN** an IP submits a request well below the configured limit
- **THEN** the handler runs normally and the rate-limit counter for that IP is incremented

### Requirement: Terms-of-service acknowledgement
The system SHALL persist a per-user timestamp of when each user accepted the
Terms of Service, Privacy Policy, and Investment Disclaimer.

#### Scenario: tosAcceptedAt column
- **GIVEN** the `user` table
- **THEN** a `tos_accepted_at` (or equivalent) timestamp column SHALL be present and NOT NULL after migration
- **AND** every existing user is backfilled to the migration date

#### Scenario: Endpoint for Google interstitial
- **WHEN** an authenticated user without `tosAcceptedAt` issues `POST /api/account/accept-tos`
- **THEN** the column is set to the current timestamp and the response is HTTP 200

#### Scenario: Blocked routes when ToS not accepted
- **GIVEN** an authenticated user whose `tos_accepted_at` is null
- **WHEN** the user issues a request to any protected route other than `/welcome`, `/api/account/accept-tos`, `/api/auth/*`, `/api/account/export`, or `/api/account/delete`
- **THEN** the response is HTTP 403 with `{ error: "Terms acceptance required" }`
