# Prices Specification

## Purpose

Maintain a daily AUD closing-price series for every active asset, sourced from Yahoo Finance. Provide on-demand fetch, scheduled fetch, and historical backfill. Prices feed market value, charts, and CAGR.

## Requirements

### Requirement: Price record shape
Each price row SHALL carry: `id`, `assetId`, `date` (ISO `YYYY-MM-DD`), `priceAud`, optional `priceUsd`, optional `fxRate`. `(assetId, date)` SHALL be unique.

#### Scenario: USD-quoted asset
- **GIVEN** a US-listed equity quoted in USD
- **THEN** `priceUsd` and `fxRate` are stored, and `priceAud = priceUsd / fxRate`

#### Scenario: AUD-quoted asset
- **THEN** `priceUsd` and `fxRate` MAY be null, and `priceAud` is the Yahoo close directly

### Requirement: Today's prices fetch
The system SHALL fetch the latest price for every active asset and upsert today's row.

#### Scenario: POST /api/prices/fetch
- **WHEN** an authenticated client requests a fetch
- **THEN** for each active asset, `yf.quote(yahooSymbol)` is called
- **AND** for USD-quoted assets the AUD/USD rate is fetched once via `AUDUSD=X`
- **AND** a price row for `today` is upserted (replace on conflict on `(assetId, date)`)
- **AND** `settings.lastPriceFetch` is set to the current timestamp
- **AND** failures for individual assets are logged and skipped without aborting the batch

#### Scenario: Yahoo unavailable
- **GIVEN** `yf.quote(AUDUSD=X)` throws
- **THEN** a fallback FX rate of `0.65` is used so USD-quoted prices still resolve

### Requirement: Historical backfill
The system SHALL fetch a multi-year history for an asset on demand.

#### Scenario: POST /api/prices/backfill
- **WHEN** an authenticated client requests a backfill for an asset id and date range
- **THEN** `yf.historical(yahooSymbol, { period1, period2 })` is called
- **AND** rows are upserted one per trading day in the range
- **AND** the response includes the count of rows written

### Requirement: Scheduled fetch
The system SHALL expose a cron endpoint that runs the daily price fetch.

#### Scenario: GET /api/cron/prices
- **WHEN** the request supplies a valid `CRON_SECRET` (query param or header)
- **THEN** the same logic as `POST /api/prices/fetch` runs
- **AND** the response is `{ updated: <n>, failed: <n> }`

#### Scenario: Missing or wrong cron secret
- **WHEN** the request lacks `CRON_SECRET` or supplies a wrong value
- **THEN** the response is HTTP 401

### Requirement: Read endpoint
The system SHALL expose price reads for charting.

#### Scenario: GET /api/prices?assetId=<id>&from=<date>&to=<date>
- **THEN** the response is the price rows in the date range for that asset, ordered by `date` ascending

### Requirement: Special symbol handling
The system SHALL support non-standard Yahoo symbols (e.g. gold futures `GC=F`).

#### Scenario: Gold futures
- **GIVEN** an asset with `yahooSymbol = "GC=F"`
- **WHEN** the daily fetch runs
- **THEN** the price is fetched, converted from USD to AUD using the same FX rate, and stored
