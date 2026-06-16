## MODIFIED Requirements

### Requirement: Read settings
The system SHALL expose the current settings (without secrets) to authenticated clients.

#### Scenario: GET /api/settings
- **WHEN** an authenticated client requests settings
- **THEN** the response is `{ email, emailNotifications }`
- **AND** `password_hash` is never returned
- **AND** the legacy `lastPriceFetch`, `lastRebalanceCheck`, `lastEmailPoll` fields are not included

#### Scenario: First-time
- **GIVEN** no `settings` row exists
- **THEN** the response is `{ needsSetup: true }`

### Requirement: CMC account mappings
The system SHALL expose CRUD for the `cmc_account_mappings` table, gated on
proof-of-ownership of the CMC account number.

#### Scenario: List mappings
- **WHEN** an authenticated client `GET /api/settings/cmc-accounts`
- **THEN** the response is `[{ id, cmcAccountNumber, profileId, label, verified: boolean }]`
- **AND** only rows whose profile is owned by the authenticated user are returned

#### Scenario: Create mapping
- **WHEN** an authenticated client `POST /api/settings/cmc-accounts` with `{ cmcAccountNumber, profileId, label? }`
- **THEN** a row is inserted with `verified=false`; the mapping is not active for IMAP ingestion until verification completes
- **AND** if the account number already exists for another user the response is HTTP 409 and no row is created
- **AND** the response includes a verification instruction (e.g. "upload a CMC confirmation PDF to verify")

#### Scenario: Delete mapping
- **WHEN** an authenticated client `DELETE /api/settings/cmc-accounts/{id}` where the mapping's profile belongs to the user
- **THEN** the row is deleted

#### Scenario: IMAP feature flag disabled
- **GIVEN** the IMAP feature flag is off (`EMAIL_POLL_ENABLED !== "true"`)
- **WHEN** the settings UI loads
- **THEN** the CMC mappings section is hidden from the page
- **AND** the API routes return `{ error: "Feature disabled" }` with HTTP 503

## REMOVED Requirements

### Requirement: Cron timestamps
**Reason**: The singleton `settings` row was being updated without a `WHERE`
clause (corruption risk if the table ever grew) and the three `lastXxx`
timestamps acted as a global cooldown that one user could starve for all
others. Cron state moves to a new `cron_runs` table; per-user price-fetch
cooldown moves to an in-memory limiter keyed by `user.id`.

**Migration**: Drop the `last_price_fetch`, `last_rebalance_check`, and
`last_email_poll` columns from `settings` once the new `cron_runs` table is
in place. Code that read these timestamps reads `cron_runs` instead. UI that
displayed them now reads from `cron_runs` via a new `GET /api/cron/status`
endpoint.

## ADDED Requirements

### Requirement: Singleton update safety
Every UPDATE against the `settings` table SHALL include `WHERE id = 1` so an
accidental second row could never be silently overwritten.

#### Scenario: Settings update query
- **WHEN** any server code calls `db.update(settings).set(...)`
- **THEN** the query includes a `.where(eq(settings.id, 1))` clause
- **AND** no settings UPDATE is issued without a WHERE in any module under `src/`

### Requirement: Cron run tracking
The system SHALL record the last successful run timestamp and status for each
cron job in a `cron_runs` table keyed by `job_name`.

#### Scenario: Cron run completes
- **WHEN** any `/api/cron/<job>` handler returns successfully
- **THEN** the `cron_runs` row for that job_name is upserted with `last_run_at = now`, `last_status = "ok"`, and a small JSON `last_summary`

#### Scenario: GET /api/cron/status
- **WHEN** an authenticated client requests cron status
- **THEN** the response is `[{ jobName, lastRunAt, lastStatus, lastSummary }]` for every job
- **AND** no secrets are exposed
