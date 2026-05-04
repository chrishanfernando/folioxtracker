# Auth Specification

## Purpose

Gate all non-public routes behind a single shared password. Issue a long-lived JWT in an HTTP-only cookie after successful login. Allow first-time setup when no password has been configured yet. This capability is intentionally single-user — there is no user table, no roles, no signup flow beyond the one-shot setup step.

## Requirements

### Requirement: First-time setup
The system SHALL allow a password to be set exactly once, when no `settings` row exists.

#### Scenario: No settings row exists
- **GIVEN** the `settings` table is empty
- **WHEN** a client `POST /api/auth` with `{ action: "check" }`
- **THEN** the response is `{ needsSetup: true }`

#### Scenario: Initial setup with a chosen password
- **GIVEN** the `settings` table is empty
- **WHEN** a client `POST /api/auth` with `{ action: "setup", password: "<pw>" }`
- **THEN** a `settings` row is inserted with `password_hash = bcrypt(pw, 12)`
- **AND** a session cookie is issued
- **AND** the response is `{ success: true }` with HTTP 200

#### Scenario: Setup attempted after the system is already configured
- **GIVEN** at least one `settings` row exists
- **WHEN** a client `POST /api/auth` with `action: "setup"`
- **THEN** the response is `{ error: "Already set up" }` with HTTP 400 and no cookie is set

### Requirement: Password login
The system SHALL exchange a valid password for a session cookie.

#### Scenario: Correct password
- **GIVEN** a `settings` row with `password_hash` matching the submitted password
- **WHEN** a client `POST /api/auth` with `{ password: "<pw>" }`
- **THEN** the response is `{ success: true }` with HTTP 200
- **AND** a `session` cookie is set (HTTP-only, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` (30 days), `Secure` only when `FORCE_HTTPS=true`)
- **AND** the cookie value is a JWT signed HS256 with `JWT_SECRET`, payload `{ authenticated: true }`, expiry 30 days

#### Scenario: Incorrect password
- **GIVEN** a `settings` row exists
- **WHEN** the submitted password fails `bcrypt.compare`
- **THEN** the response is `{ error: "Invalid password" }` with HTTP 401 and no cookie is set

### Requirement: Route protection
The system SHALL block unauthenticated access to all routes except an explicit allowlist.

#### Scenario: Public paths bypass auth
- **GIVEN** a request to a path under `/login`, `/api/auth`, or `/api/cron`
- **WHEN** the middleware runs
- **THEN** the request is forwarded without inspecting the cookie

#### Scenario: Missing cookie on a protected route
- **GIVEN** a request to any other route
- **AND** no `session` cookie is present
- **WHEN** the middleware runs
- **THEN** the response is a 307 redirect to `/login`

#### Scenario: Invalid or expired cookie
- **GIVEN** a request with a `session` cookie that fails `jwtVerify`
- **WHEN** the middleware runs
- **THEN** the response is a 307 redirect to `/login`

### Requirement: Password change
The system SHALL allow the password to be changed only when the current password is supplied.

#### Scenario: Correct current password
- **WHEN** an authenticated client `PUT /api/settings` with `{ currentPassword, newPassword }`
- **AND** `currentPassword` matches the stored hash
- **THEN** `password_hash` is replaced with `bcrypt(newPassword, 12)`
- **AND** the response is HTTP 200

#### Scenario: Incorrect current password
- **WHEN** `currentPassword` does not match the stored hash
- **THEN** the response is `{ error: "Invalid current password" }` with HTTP 401
- **AND** the stored hash is unchanged

### Requirement: Configuration
The system SHALL load `JWT_SECRET` from the environment.

#### Scenario: JWT_SECRET unset in production
- **GIVEN** `JWT_SECRET` is not provided
- **WHEN** the app starts
- **THEN** the fallback `dev-secret-change-in-production` is used and a developer-visible warning SHOULD be surfaced (production deployments MUST set `JWT_SECRET`).
