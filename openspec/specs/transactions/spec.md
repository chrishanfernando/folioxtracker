# Transactions Specification

## Purpose

Record every action that changes an asset position: buys, sells, dividends, splits, and corrections. Transactions are the authoritative ledger; holdings, cost basis, and historical value are derived from them. All monetary values are stored in AUD; foreign-currency context is preserved alongside.

## Requirements

### Requirement: Transaction record shape
Each transaction SHALL carry: `id`, `assetId`, `date` (ISO `YYYY-MM-DD`), `action`, `quantity`, optional `unitPriceLocal`, optional `localCurrency`, optional `fxRate`, `unitPriceAud`, `splitMultiplier` (default `1`), `adjustedQty`, `totalAud`, optional `source`, optional `comment`.

#### Scenario: Foreign-currency buy
- **GIVEN** a buy of 10 shares at USD 100 with FX 0.65 USD/AUD
- **THEN** the row stores `unit_price_local = 100`, `local_currency = "USD"`, `fx_rate = 0.65`, `unit_price_aud ≈ 153.85`, `total_aud ≈ 1538.46`

#### Scenario: AUD-native trade
- **GIVEN** a buy of 100 shares at AUD 50
- **THEN** `unit_price_local`, `local_currency`, and `fx_rate` MAY be null
- **AND** `unit_price_aud = 50` and `total_aud = 5000`

### Requirement: Supported actions
The `action` field SHALL be one of: `BUY`, `SELL`, `DIV` (dividend), `SPLIT`, `ADJUST`.

#### Scenario: Unknown action rejected
- **WHEN** an authenticated client `POST /api/transactions` with `action: "TRANSFER"`
- **THEN** the response is HTTP 400 with `{ error: <message> }`

### Requirement: Split adjustment
The system SHALL maintain `adjusted_qty = quantity × split_multiplier` so that prior-period quantities reflect later splits.

#### Scenario: 2-for-1 split applied
- **GIVEN** an existing buy of 100 shares at split_multiplier 1
- **WHEN** a `SPLIT` transaction with multiplier 2 is recorded
- **THEN** subsequent holding calculations treat that buy as 200 shares for cost-basis and quantity purposes
- **AND** historical `total_aud` is unchanged

### Requirement: CRUD endpoints
The system SHALL expose create, list, update, and delete operations for transactions.

#### Scenario: Create
- **WHEN** an authenticated client `POST /api/transactions` with a valid payload
- **THEN** a row is inserted and the response is the created record

#### Scenario: List with filters
- **WHEN** an authenticated client `GET /api/transactions?assetId=<id>&from=<date>&to=<date>`
- **THEN** the response is the matching transactions, scoped to the active profile via the asset, ordered by `date` descending

#### Scenario: Update or delete
- **WHEN** an authenticated client `PUT /api/transactions/{txId}` or `DELETE /api/transactions/{txId}`
- **THEN** the row is updated/deleted only if its asset belongs to the active profile, else HTTP 404

### Requirement: Idempotent imports
Importer-created transactions SHALL be deduplicated against existing rows.

#### Scenario: Re-importing the same CSV
- **GIVEN** a transaction set was previously imported
- **WHEN** the same file is uploaded again
- **THEN** no duplicate rows are inserted (match on `assetId + date + action + quantity + unit_price_aud`)

### Requirement: Source tag
The `source` field SHALL identify how the transaction entered the system.

#### Scenario: Manual entry
- **THEN** `source = "manual"` (or null)

#### Scenario: Importer entry
- **THEN** `source` is set to the importer name (e.g. `"cmc"`, `"stake"`, `"swyftx"`, `"ir"`, `"cmc-email"`)
