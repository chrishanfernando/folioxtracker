## MODIFIED Requirements

### Requirement: Ticker resolution
The system SHALL map source-specific symbols to internal asset rows in two
decoupled steps: (1) resolve `sourceTicker → canonical symbol`, consulting
profile-scoped DB overrides first and the code seed maps second; (2) look up the
asset by `(symbol, profileId)` in the database, using the existing asset when
present and otherwise creating it from override or seed metadata. A resolved
symbol that already exists as a DB asset SHALL import even when the symbol is
absent from `ASSET_MAP`.

#### Scenario: Known mapping via seed map
- **GIVEN** `ticker-map.ts` resolves CMC `BHP` to `ASX:BHP` and an asset `ASX:BHP` exists for the profile
- **WHEN** a CMC row references `BHP`
- **THEN** the resulting transaction is linked to that existing asset

#### Scenario: Resolved symbol matches an existing asset absent from ASSET_MAP
- **GIVEN** the profile already has an asset with symbol `NYSE:BRK.B`
- **AND** `NYSE:BRK.B` is not present in `ASSET_MAP`
- **WHEN** a row resolves to `NYSE:BRK.B`
- **THEN** the transaction is linked to the existing `NYSE:BRK.B` asset rather than being skipped

#### Scenario: DB override resolves a ticker the seed map does not
- **GIVEN** the seed map does not resolve Stake ticker `XYZ`
- **AND** a profile-scoped override maps `stake`/`XYZ` to `NASDAQ:XYZ`
- **WHEN** a Stake row for `XYZ` is imported for that profile
- **THEN** it resolves to `NASDAQ:XYZ` and imports

#### Scenario: Unknown symbol is surfaced, not dropped
- **GIVEN** an imported row whose ticker resolves via neither a DB override nor the seed maps
- **THEN** the row is surfaced in the preview with an `unknown` status and is not imported
- **AND** the rest of the file continues to import

## ADDED Requirements

### Requirement: Inline ticker mapping from the import preview
The import preview SHALL let a user resolve an `unknown` row by supplying a
canonical symbol, category, and a validated Yahoo symbol. On a successful save
the row SHALL resolve on a re-run of the preview without re-selecting the file.

#### Scenario: Map an unknown ticker and re-resolve
- **GIVEN** a Stake preview shows `TECHZ` with status `unknown`
- **WHEN** the user submits a mapping `TECHZ → NASDAQ:TECHZ` with a Yahoo symbol that validates
- **AND** the preview is re-run for the same file
- **THEN** the `TECHZ` row now shows status `new` (or `duplicate`) instead of `unknown`

#### Scenario: Mapping with an unverifiable Yahoo symbol is refused
- **WHEN** the user submits a mapping whose Yahoo symbol returns no quote
- **THEN** the save is rejected with a `400` and the row remains `unknown`

### Requirement: Confirm imports only resolved rows
On confirm, the system SHALL insert transactions only for rows that resolved to
an asset, and SHALL skip rows still `unknown`. The response SHALL report the
skipped unknown tickers.

#### Scenario: Mixed file confirms resolved rows and reports the rest
- **GIVEN** a confirmed Stake import where 5 rows resolved and 2 remain unmapped
- **THEN** 5 transactions are inserted
- **AND** the response reports the 2 unmapped source tickers and does not insert them
