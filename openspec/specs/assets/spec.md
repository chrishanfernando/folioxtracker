# Assets Specification

## Purpose

Maintain the registry of instruments (equities, ETFs, crypto, gold) the user holds or has held. An asset is the unit linking transactions, prices, and category targets. Assets are profile-scoped and carry the metadata required to fetch prices from Yahoo Finance and to render UI labels.

## Requirements

### Requirement: Asset record shape
Each asset SHALL carry: `id`, `profileId`, `symbol`, `name`, `displayTicker`, `yahooSymbol`, `category`, `platform`, `isActive`.

#### Scenario: Symbol vs display ticker vs Yahoo symbol
- **GIVEN** an asset such as `BHP.AX` listed on CMC
- **THEN** `symbol` is the canonical internal symbol used by importers (`BHP`)
- **AND** `displayTicker` is the user-facing label (`BHP.AX`)
- **AND** `yahooSymbol` is the symbol passed to `yahoo-finance2` for price fetches (`BHP.AX`)

### Requirement: Asset listing
The system SHALL expose endpoints to list assets and to fetch a single asset by id.

#### Scenario: List active assets for the active profile
- **WHEN** an authenticated client `GET /api/assets/options`
- **THEN** the response includes only assets where `profile_id` matches the active profile and `is_active = true`
- **AND** each entry includes at least `id`, `displayTicker`, `symbol`, `category`

#### Scenario: Fetch a single asset
- **WHEN** an authenticated client `GET /api/assets/{id}`
- **THEN** the response is the full asset record if it belongs to the active profile, else HTTP 404

### Requirement: Asset deactivation
The system SHALL support marking an asset inactive without deleting transactions or prices.

#### Scenario: Closing a holding
- **WHEN** an authenticated client `POST /api/holdings/{id}/close`
- **THEN** the asset's `is_active` flag is set to `false`
- **AND** existing `transactions` and `prices` rows for that asset are preserved
- **AND** subsequent `GET /api/assets/options` responses do not include the asset

### Requirement: Category as user-defined
Categories SHALL be free-form strings that group assets for rebalancing.

#### Scenario: Adding a new category
- **GIVEN** the user creates an asset with `category: "Bonds"` for the first time
- **THEN** the asset is created without error
- **AND** "Bonds" becomes available for category-level reporting and target setting

### Requirement: Yahoo symbol consistency
The system SHALL ensure each active asset has a non-empty `yahoo_symbol` so price fetches do not silently no-op.

#### Scenario: Active asset with empty Yahoo symbol
- **WHEN** an active asset has `yahoo_symbol = ""`
- **THEN** the price-fetch routine SHALL skip it and surface a warning rather than treating it as priced at zero
