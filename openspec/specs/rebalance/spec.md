# Rebalance Specification

## Purpose

Compare current category allocations against user-set targets, surface drift, and recommend buy amounts that move the portfolio back toward target without selling. Optional periodic notification when drift breaches thresholds.

## Requirements

### Requirement: Category targets
The system SHALL store target percentages per category per profile, with a per-target drift threshold.

#### Scenario: Setting a target
- **WHEN** an authenticated client `PUT /api/rebalance` with `{ category, targetPct, threshold }`
- **THEN** the row is upserted in `category_targets` for the active profile
- **AND** `threshold` defaults to `5` (percentage points) when not provided

#### Scenario: Target validation
- **WHEN** target percentages for the active profile sum to more than 100
- **THEN** the system SHOULD warn the client (response `{ warning: "Targets sum to <n>%" }`) but MAY still accept the change

### Requirement: Drift calculation
The system SHALL compute, per category present in current holdings or in targets, the current %, target %, drift, threshold, and a `needsRebalance` flag.

#### Scenario: Drift formula
- **THEN** `currentPct = categoryValue / totalValue × 100`
- **AND** `driftPct = currentPct − targetPct`
- **AND** `needsRebalance = (targetPct > 0) AND (|driftPct| > threshold)`

#### Scenario: Category with no target
- **GIVEN** holdings exist in a category that has no `category_targets` row
- **THEN** the row is reported with `targetPct = 0`, `threshold = 5`, `needsRebalance = false`

### Requirement: Buy-only recommendations
The system SHALL produce a buy plan that allocates a user-supplied amount across underweight categories.

#### Scenario: GET /api/rebalance recommendations
- **WHEN** an authenticated client requests recommendations with an amount to invest
- **THEN** the response includes per-category amounts whose sum equals the requested amount (within rounding)
- **AND** allocations prioritise categories with the largest negative drift first
- **AND** for each category, suggested asset(s) and unit counts are computed using the latest `priceAud`
- **AND** a `projectedAllocation` array shows the post-purchase percentages alongside current and target

#### Scenario: All categories at or above target
- **GIVEN** every category's `currentPct >= targetPct`
- **THEN** the response is `{ recommendations: [], projectedAllocation: <unchanged>, totalInvested: 0 }`

### Requirement: Scheduled drift check
The system SHALL expose a cron endpoint that records when drift was last checked and optionally emails the user.

#### Scenario: GET /api/cron/rebalance
- **WHEN** a valid `CRON_SECRET` is supplied
- **THEN** drift is computed for every profile
- **AND** `settings.lastRebalanceCheck` is set to the current timestamp
- **AND** if any category has `needsRebalance = true` AND `settings.emailNotifications = true` AND `RESEND_API_KEY` is set AND `settings.email` is non-empty, an email is dispatched summarising the drift

#### Scenario: Missing or wrong cron secret
- **THEN** the response is HTTP 401
