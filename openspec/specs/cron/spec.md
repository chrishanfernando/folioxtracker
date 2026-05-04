# Cron Specification

## Purpose

Run scheduled background work — daily price refresh, drift check + optional notification, and IMAP email polling — without exposing any of it to unauthenticated public traffic. Cron endpoints are designed to be invoked by an external scheduler (Vercel Cron, system cron + curl, etc.) holding a shared secret.

## Requirements

### Requirement: Shared-secret authorisation
All `/api/cron/*` endpoints SHALL require `CRON_SECRET`.

#### Scenario: Valid secret
- **WHEN** the request supplies the secret via either `?secret=<CRON_SECRET>` query param or `Authorization: Bearer <CRON_SECRET>` header
- **THEN** the handler runs

#### Scenario: Missing or wrong secret
- **THEN** the response is HTTP 401 with `{ error: "Unauthorized" }` and the handler does not run

### Requirement: Bypass auth middleware
Cron paths SHALL be in the middleware allowlist so they are reachable without a session cookie.

#### Scenario: Public path allowlist
- **GIVEN** a request to `/api/cron/<anything>`
- **THEN** the auth middleware does not redirect to `/login`

### Requirement: Endpoints
The system SHALL expose `/api/cron/prices`, `/api/cron/rebalance`, and `/api/cron/email`.

#### Scenario: /api/cron/prices
- **THEN** runs the price-fetch routine for every active asset and updates `settings.lastPriceFetch`

#### Scenario: /api/cron/rebalance
- **THEN** computes drift for every profile, updates `settings.lastRebalanceCheck`, and dispatches a notification email if conditions in the Settings spec are met

#### Scenario: /api/cron/email
- **THEN** polls the configured IMAP mailbox per the Import spec and updates `settings.lastEmailPoll`

### Requirement: Idempotent and tolerant
Cron handlers SHALL be safe to invoke repeatedly and SHALL NOT abort an entire batch on a single failure.

#### Scenario: One asset fails to fetch
- **GIVEN** `yf.quote` throws for asset X during `/api/cron/prices`
- **THEN** the handler logs the failure, continues with remaining assets, and returns `{ updated: <n>, failed: <m>, failures: [...] }`

#### Scenario: Repeated invocation in the same minute
- **THEN** running the same cron twice in quick succession SHALL NOT corrupt state (price upserts replace, email polling uses `lastEmailPoll` watermark, etc.)

### Requirement: Response shape
Cron handlers SHALL return a small JSON summary suitable for log inspection.

#### Scenario: Successful prices run
- **THEN** the response is `{ updated: <n>, failed: <m>, failures?: [{ symbol, error }] }`

#### Scenario: Successful rebalance run
- **THEN** the response is `{ profilesChecked: <n>, alerts: <m> }`

#### Scenario: Successful email run
- **THEN** the response is `{ processed: <n>, inserted: <n>, errors?: [...] }`
