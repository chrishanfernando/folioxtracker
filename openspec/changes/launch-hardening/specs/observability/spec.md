## ADDED Requirements

### Requirement: Health endpoint
The system SHALL expose `GET /api/health` for uptime monitors. The endpoint
SHALL require no authentication, return no sensitive information, and respond
quickly.

#### Scenario: Healthy
- **GIVEN** the DB is reachable AND the price-source last-success timestamp is within 24 hours
- **WHEN** an unauthenticated client `GET /api/health`
- **THEN** the response is HTTP 200 with `{ ok: true, db: "ok", prices: "ok", buildSha: "<sha>", uptime: <seconds> }`
- **AND** the response carries no email, no user id, and no env var values

#### Scenario: DB unreachable
- **GIVEN** a `SELECT 1` ping to the configured DB throws
- **WHEN** an unauthenticated client `GET /api/health`
- **THEN** the response is HTTP 503 with `{ ok: false, db: "error" }`
- **AND** the underlying error string is logged server-side, not returned to the client

#### Scenario: Stale prices
- **GIVEN** the `cron_runs.prices.last_run_at` is more than 24 hours old
- **WHEN** an unauthenticated client `GET /api/health`
- **THEN** the response is HTTP 200 with `prices: "degraded"`
- **AND** `ok` is `true` because the app can still serve reads

### Requirement: Error tracking
The system SHALL capture unhandled server errors and client errors to a
configurable error-tracking backend (Sentry by default). When `SENTRY_DSN` is
unset, the system SHALL degrade gracefully to server logs only.

#### Scenario: Server route throws
- **GIVEN** `SENTRY_DSN` is set and an `/api/*` handler throws
- **WHEN** the error is caught by the global error wrapper
- **THEN** the error is captured to Sentry with a generated `request_id`, the active user id (if any), the route path, and the HTTP method
- **AND** no request body fields are sent to Sentry except an explicit allowlist (HTTP method, route, status)

#### Scenario: Client-side error
- **GIVEN** `SENTRY_DSN` is set and a client-side React error boundary catches an exception
- **THEN** the error is captured to Sentry with the active user id (if any) and the route
- **AND** no email address, no portfolio data, and no form contents are sent

#### Scenario: Sentry not configured
- **GIVEN** `SENTRY_DSN` is unset
- **WHEN** a server route throws
- **THEN** the error is written to `console.error` with the generated `request_id` and no Sentry call is attempted
- **AND** the application continues to serve requests normally

### Requirement: Sanitised API error responses
Every `/api/*` route SHALL return a stable error envelope. The raw error
message SHALL never reach the client for 500-class errors.

#### Scenario: Internal server error
- **WHEN** a route handler throws an unknown error
- **THEN** the response is HTTP 500 with `{ error: "Internal error", requestId: "<uuid>" }`
- **AND** the response header `x-request-id` carries the same id
- **AND** the underlying error stack is logged + captured to Sentry with that `request_id`

#### Scenario: Validation failure
- **WHEN** a route handler catches a `ValidationError`
- **THEN** the response is HTTP 400 with `{ error: "Invalid request", requestId: "<uuid>" }`
- **AND** the zod issue list is logged + captured to Sentry but not returned

#### Scenario: Forbidden
- **WHEN** a route handler catches a `ForbiddenError`
- **THEN** the response is HTTP 403 with `{ error: "Forbidden", requestId: "<uuid>" }`

#### Scenario: Not found
- **WHEN** a route handler catches a `NotFoundError`
- **THEN** the response is HTTP 404 with `{ error: "Not found", requestId: "<uuid>" }`

#### Scenario: No raw error strings
- **GIVEN** the codebase
- **WHEN** static analysis runs
- **THEN** no `/api/**/route.ts` file contains `String(error)`, `${error}`, `error.message`, or `error.toString()` in a `return NextResponse.json` call
