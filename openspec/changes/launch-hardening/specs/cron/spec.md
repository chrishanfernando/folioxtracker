## MODIFIED Requirements

### Requirement: Shared-secret authorisation
All `/api/cron/*` endpoints SHALL require `CRON_SECRET`. The handler SHALL refuse
to run if `CRON_SECRET` is undefined or empty at the time of the request, even if
the caller's supplied value would technically match — the comparison against
`"Bearer undefined"` MUST NOT succeed.

#### Scenario: Valid secret
- **WHEN** the request supplies the secret via either `?secret=<CRON_SECRET>` query param or `Authorization: Bearer <CRON_SECRET>` header
- **AND** `CRON_SECRET` is set to a non-empty string in the process environment
- **THEN** the handler runs

#### Scenario: CRON_SECRET unset at request time
- **GIVEN** `process.env.CRON_SECRET` is `undefined` or an empty string
- **WHEN** any client requests `/api/cron/<any>` with `Authorization: Bearer undefined` or any other value
- **THEN** the response is HTTP 401 with `{ error: "Unauthorized" }`
- **AND** the handler does not run

#### Scenario: Missing or wrong secret
- **THEN** the response is HTTP 401 with `{ error: "Unauthorized" }` and the handler does not run

### Requirement: Endpoints
The system SHALL expose `/api/cron/prices`, `/api/cron/prices/backfill`,
`/api/cron/rebalance`, and `/api/cron/email`.

#### Scenario: /api/cron/prices
- **THEN** runs the price-fetch routine for every active asset across every profile and updates the `prices` row in `cron_runs`

#### Scenario: /api/cron/prices/backfill
- **THEN** runs the historical backfill per the Prices spec and updates the `prices_backfill` row in `cron_runs`

#### Scenario: /api/cron/rebalance
- **THEN** computes drift for every profile, updates the `rebalance` row in `cron_runs`, and dispatches a notification email per the Settings spec

#### Scenario: /api/cron/email
- **GIVEN** the IMAP feature flag is enabled (`EMAIL_POLL_ENABLED === "true"`)
- **THEN** polls the configured IMAP mailbox per the Import spec and updates the `email_poll` row in `cron_runs`

#### Scenario: /api/cron/email — feature disabled
- **GIVEN** `EMAIL_POLL_ENABLED !== "true"`
- **WHEN** the cron endpoint is invoked with a valid `CRON_SECRET`
- **THEN** the response is `{ skipped: "feature disabled" }` with HTTP 200 and no IMAP connection is made

## ADDED Requirements

### Requirement: Boot-time CRON_SECRET check
The application SHALL refuse to start in production when `CRON_SECRET` is missing
or empty.

#### Scenario: Missing in production
- **GIVEN** `NODE_ENV === "production"` and `CRON_SECRET` is not set
- **WHEN** the Next.js process starts
- **THEN** the process exits non-zero before any request is served, with a readable error message
