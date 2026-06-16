## MODIFIED Requirements

### Requirement: Today's prices fetch
The system SHALL fetch the latest price for every active asset under the caller's
active profile and upsert today's row. The fetch SHALL be scoped per user — one
user's request MUST NOT trigger writes for another user's assets.

#### Scenario: POST /api/prices/fetch
- **WHEN** an authenticated client requests a fetch
- **THEN** the active profile is resolved via the standard header/query/cookie mechanism and verified to be owned by the caller
- **AND** `fetchCurrentPrices(profileId)` selects only `assets` where `profile_id = <active profile>` and `is_active = true`
- **AND** for each such asset, `yf.quote(yahooSymbol)` is called
- **AND** for USD-quoted assets the AUD/USD rate is fetched once via `AUDUSD=X`
- **AND** a price row for `today` is upserted (replace on conflict on `(assetId, date)`)
- **AND** failures for individual assets are logged and skipped without aborting the batch
- **AND** the in-memory per-user cooldown is updated so the same user cannot trigger another fetch within 60 seconds

#### Scenario: Per-user cooldown
- **GIVEN** user `U` issued `POST /api/prices/fetch` less than 60 seconds ago
- **WHEN** the same user issues a second `POST /api/prices/fetch`
- **THEN** the response is HTTP 429 with `{ error: "Too many requests" }`
- **AND** no Yahoo Finance calls are made
- **AND** another user's cooldown is unaffected

#### Scenario: Yahoo unavailable
- **GIVEN** `yf.quote(AUDUSD=X)` throws
- **THEN** a fallback FX rate of `0.65` is used so USD-quoted prices still resolve

### Requirement: Historical backfill
The system SHALL fetch a multi-year history for an asset only via the cron path.
There SHALL be no authenticated-user endpoint that triggers backfill.

#### Scenario: Cron backfill — /api/cron/prices/backfill
- **WHEN** the request supplies a valid `CRON_SECRET`
- **THEN** the handler iterates active assets across all profiles in serial, calling `yf.historical(yahooSymbol, { period1, period2 })` with a small inter-request delay to respect Yahoo rate limits
- **AND** rows are upserted one per trading day in the range
- **AND** the response is `{ assetsProcessed: <n>, rowsWritten: <n>, failed: <m> }`
- **AND** the `cron_runs.prices_backfill` row is updated

#### Scenario: Missing or wrong cron secret
- **WHEN** the request lacks `CRON_SECRET` or supplies a wrong value
- **THEN** the response is HTTP 401
- **AND** no Yahoo calls are made

#### Scenario: Legacy `/api/prices/backfill` removed
- **GIVEN** the deprecated user-facing endpoint
- **WHEN** any client `POST /api/prices/backfill`
- **THEN** the response is HTTP 410 Gone (or 404, depending on routing) and no work is done

### Requirement: Scheduled fetch
The system SHALL expose a cron endpoint that runs the daily price fetch across
all users.

#### Scenario: GET /api/cron/prices
- **WHEN** the request supplies a valid `CRON_SECRET` (query param or header)
- **THEN** the handler iterates profiles in serial and calls `fetchCurrentPrices(profileId)` for each
- **AND** the response is `{ profilesProcessed: <n>, updated: <n>, failed: <n> }`
- **AND** the `cron_runs.prices` row is updated on completion

#### Scenario: Missing or wrong cron secret
- **WHEN** the request lacks `CRON_SECRET` or supplies a wrong value
- **THEN** the response is HTTP 401
