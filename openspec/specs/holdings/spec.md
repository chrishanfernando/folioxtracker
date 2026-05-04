# Holdings Specification

## Purpose

Compute current open positions, cost basis, market value, profit/loss, and historical value series from the transactions ledger and the latest prices. Holdings are derived state — there is no holdings table; recomputation is the source of truth.

## Requirements

### Requirement: Open holding snapshot
The system SHALL compute, per active asset with non-zero net quantity, a snapshot containing: `assetId`, `symbol`, `displayTicker`, `name`, `category`, `platform`, `quantity`, `avgCostAud`, `totalCostAud`, `currentPriceAud`, `marketValueAud`, `profitLossAud`, `profitLossPct`, `cagr`.

#### Scenario: Net quantity calculation
- **GIVEN** transactions for an asset summed across `BUY` (+`adjusted_qty`) and `SELL` (−`adjusted_qty`)
- **WHEN** `calculateHoldings` runs
- **THEN** `quantity` is the running net; assets with `quantity = 0` are excluded from open holdings

#### Scenario: Average cost basis
- **THEN** `avgCostAud = totalCostAud / quantity` where `totalCostAud` reflects buys reduced proportionally by sells (FIFO reduction of cost basis)

#### Scenario: Market value uses latest price
- **THEN** `currentPriceAud` is the most recent price in `prices` for the asset; if no price exists, `currentPriceAud = avgCostAud` and the snapshot is flagged

#### Scenario: CAGR
- **THEN** `cagr` is the annualised return from the first buy date to today, computed from `marketValueAud` versus `totalCostAud`

### Requirement: Closed holdings
The system SHALL also report fully exited positions.

#### Scenario: Asset with net quantity zero
- **GIVEN** an asset whose buys and sells net to zero
- **WHEN** `calculateClosedHoldings` runs
- **THEN** the asset appears with `totalBought`, `totalSold`, `totalCostAud`, realised P/L, and the date of the last sell

### Requirement: Portfolio summary
The system SHALL aggregate holdings into a portfolio-level summary.

#### Scenario: GET /api/dashboard
- **WHEN** an authenticated client requests `/api/dashboard`
- **THEN** the response is `{ summary, history }` where `summary` includes `totalValue`, `totalCost`, `profitLoss`, `returnPct`, `cagr`, `holdings`, and `categoryBreakdown`
- **AND** `categoryBreakdown` sums `marketValueAud` per category and computes `pct` against `totalValue`

### Requirement: Historical value series
The system SHALL produce a daily portfolio value time series for charting.

#### Scenario: Value history
- **WHEN** an authenticated client requests dashboard data
- **THEN** `history` is an array of `{ date, value }` from the first transaction date to today, where `value` for each date uses the price as of that date (forward-filled if missing) and the holdings as of that date

### Requirement: Per-asset chart data
The system SHALL expose endpoints for per-asset price/value charts and aggregate holdings charts.

#### Scenario: Single-asset chart
- **WHEN** an authenticated client `GET /api/holdings/{id}/charts` (or equivalent)
- **THEN** the response includes the price series and the user's quantity-over-time series for that asset, scoped to the active profile

### Requirement: Close a holding
The system SHALL allow a holding to be force-closed.

#### Scenario: Closing an asset
- **WHEN** an authenticated client `POST /api/holdings/{id}/close`
- **THEN** the asset's `is_active` is set to `false`
- **AND** subsequent open-holdings calculations exclude it
- **AND** transactions and prices are preserved
