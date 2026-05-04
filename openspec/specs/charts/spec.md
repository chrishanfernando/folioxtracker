# Charts Specification

## Purpose

Visualise price history and the user's position over time for individual assets, plus aggregate views across the portfolio. Charting is read-only — it consumes prices and transactions and produces series; it never mutates state.

## Requirements

### Requirement: Asset lookup for the chart UI
The system SHALL expose a search endpoint that returns assets matching a query.

#### Scenario: GET /api/charts/lookup?q=<term>
- **WHEN** an authenticated client searches with a non-empty `q`
- **THEN** the response is up to N assets where `displayTicker`, `symbol`, or `name` matches `q` case-insensitively, scoped to the active profile

### Requirement: Per-asset chart series
The system SHALL produce a price series and a quantity-held-over-time series for any asset the user has held.

#### Scenario: Asset with transactions
- **WHEN** an authenticated client requests the chart for an asset id
- **THEN** the response includes `priceSeries: [{ date, priceAud }]` from the first transaction date to today
- **AND** `quantitySeries: [{ date, quantity }]` reflecting net adjusted quantity at each point
- **AND** `costBasisSeries: [{ date, totalCostAud }]` reflecting cumulative cost over time

### Requirement: Holdings aggregate chart
The system SHALL expose `/api/holdings/charts` returning the portfolio-level value series.

#### Scenario: GET /api/holdings/charts
- **THEN** the response is the same daily portfolio value series surfaced by the dashboard, suitable for the `/charts` page
- **AND** the series is forward-filled across non-trading days

### Requirement: Time-frame filter
The charts page SHOULD share the dashboard's time-frame filter behaviour (1M / 3M / 6M / 1Y / ALL).

#### Scenario: Filter applied
- **WHEN** the user picks 6M
- **THEN** the chart shows the last 6 months of the chosen series

### Requirement: Zoom interaction
The charts page MAY support drag-to-zoom on the value chart.

#### Scenario: User drags a range
- **THEN** the chart rescales to the selected window
- **AND** a "reset zoom" affordance is available
