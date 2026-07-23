## ADDED Requirements

### Requirement: Profile-scoped ticker overrides
The system SHALL persist ticker overrides that map a `(source, sourceTicker)`
pair to a canonical asset, owned by a user and scoped to a profile. An override
SHALL store `symbol`, `name`, `displayTicker`, `yahooSymbol`, and `category`.

#### Scenario: Override is unique per profile and source ticker
- **WHEN** a `stake` override for `sourceTicker` `TCEHY` already exists for profile 7
- **AND** a second override for `stake`/`TCEHY`/profile 7 is saved
- **THEN** the existing override is replaced (upsert), not duplicated
- **AND** an override for the same `stake`/`TCEHY` under a different profile is stored independently

#### Scenario: Overrides are isolated by owner
- **WHEN** user A has a `stake`/`XYZ` override on their profile
- **AND** user B imports a `stake` file containing `XYZ` under user B's profile
- **THEN** user A's override does not resolve user B's row

### Requirement: Override precedence over code seed maps
Ticker resolution SHALL consult profile-scoped DB overrides before the built-in
code maps (`ASSET_MAP`, `STAKE_US_TICKER_MAP`, and the per-source resolvers). A
DB override SHALL take precedence when both resolve the same source ticker.

#### Scenario: DB override wins over seed map
- **GIVEN** the seed map resolves `stake` ticker `BRK.B` to `NYSE:BRK.B`
- **AND** a profile-scoped override maps `stake`/`BRK.B` to `NASDAQ:BRK.B`
- **WHEN** a Stake row for `BRK.B` is resolved for that profile
- **THEN** it resolves to `NASDAQ:BRK.B`

#### Scenario: Seed map used when no override exists
- **GIVEN** no override exists for `stake`/`IOO.ASX` on the profile
- **WHEN** a Stake row for `IOO.ASX` is resolved
- **THEN** it resolves to `ASX:IOO` via the seed convention

### Requirement: Live Yahoo-symbol validation before save
The system SHALL validate the supplied `yahooSymbol` against the price provider
before persisting an override. An override with a symbol that returns no quote
SHALL NOT be saved.

#### Scenario: Valid symbol is saved
- **WHEN** a user submits an override with `yahooSymbol` `BRK-B`
- **AND** the price provider returns a quote for `BRK-B`
- **THEN** the endpoint responds `200` and the override is persisted

#### Scenario: Invalid symbol is rejected
- **WHEN** a user submits an override with `yahooSymbol` `NOTAREALTICKER`
- **AND** the price provider returns no quote / throws
- **THEN** the endpoint responds `400` with a message naming the unverifiable symbol
- **AND** no override row is written

### Requirement: Override ownership and tenancy
Override create/read SHALL require an authenticated user and a resolved active
profile the user owns. Requests targeting a profile the user does not own SHALL
return `404`.

#### Scenario: Cross-tenant save is rejected
- **WHEN** an authenticated user posts an override targeting a profile they do not own
- **THEN** the system responds `404` and writes nothing
