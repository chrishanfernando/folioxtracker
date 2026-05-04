# Dashboard Specification

## Purpose

Single-screen overview of the active profile: total value, total cost, P/L (absolute and %), CAGR, category breakdown, and a portfolio value chart. Optimised for at-a-glance reading; detailed views live on `/holdings`, `/charts`, and `/rebalance`.

## Requirements

### Requirement: Dashboard data endpoint
The system SHALL expose a single endpoint that returns everything needed to render the dashboard.

#### Scenario: GET /api/dashboard
- **WHEN** an authenticated client requests the dashboard
- **THEN** the response is `{ summary, history }` for the active profile
- **AND** `summary` includes `totalValue`, `totalCost`, `profitLoss`, `returnPct`, `cagr`, `holdings`, `categoryBreakdown`
- **AND** `history` is the daily portfolio value series suitable for a line chart

### Requirement: Empty state
The system SHALL handle profiles with no transactions gracefully.

#### Scenario: Profile with zero transactions
- **THEN** the response is `{ summary: { totalValue: 0, totalCost: 0, profitLoss: 0, returnPct: 0, cagr: 0, holdings: [], categoryBreakdown: [] }, history: [] }`
- **AND** the dashboard page shows an empty state with a link to `/import` and `/transactions/new`

### Requirement: Time-frame filtering
The dashboard SHOULD support filtering the value chart to common ranges (1M, 3M, 6M, 1Y, ALL).

#### Scenario: Switching time frame
- **WHEN** the user changes the time-frame filter
- **THEN** the chart re-renders against the corresponding subset of `history`
- **AND** the summary numbers (totalValue, P/L, CAGR) reflect the selected start point where applicable

### Requirement: Profile switching
The dashboard SHALL refresh when the active profile changes.

#### Scenario: Profile change
- **WHEN** the user selects a different profile
- **THEN** the `profile` cookie is updated
- **AND** the dashboard refetches `/api/dashboard` and rerenders
