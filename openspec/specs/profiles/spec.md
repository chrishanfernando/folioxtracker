# Profiles Specification

## Purpose

Allow a single authenticated user to maintain multiple independent portfolios ("profiles"). Profiles namespace assets, transactions (via assets), and category targets. The active profile is selected by the client and propagated via a cookie so server routes can scope queries.

## Requirements

### Requirement: Profile CRUD
The system SHALL expose endpoints to list and create profiles.

#### Scenario: List profiles
- **WHEN** an authenticated client `GET /api/profiles`
- **THEN** the response is an array of `{ id, name, createdAt }` for every row in `profiles`, ordered by `id` ascending

#### Scenario: Create a profile
- **WHEN** an authenticated client `POST /api/profiles` with `{ name: "<non-empty>" }`
- **THEN** a row is inserted with `created_at = today (YYYY-MM-DD)`
- **AND** the response is the created profile

### Requirement: Active profile selection
The system SHALL determine the active profile from a `profile` cookie, defaulting to `1`.

#### Scenario: Cookie present and parseable
- **GIVEN** a request with cookie `profile=<n>` where `n` is a positive integer
- **WHEN** any profile-scoped route handler runs
- **THEN** queries are filtered by `profile_id = n`

#### Scenario: Cookie missing or unparseable
- **GIVEN** no `profile` cookie or a non-numeric value
- **WHEN** any profile-scoped route handler runs
- **THEN** queries are filtered by `profile_id = 1`

### Requirement: Profile scoping
The system SHALL scope all reads and writes that have a `profile_id` foreign key to the active profile.

#### Scenario: Listing assets
- **WHEN** an authenticated client requests assets/holdings/transactions/dashboard/rebalance for the active profile
- **THEN** the response includes only rows whose `profile_id` (directly or via the parent asset) equals the active profile

### Requirement: Default profile guarantee
The system SHALL ensure profile `id = 1` always exists.

#### Scenario: Fresh database
- **GIVEN** a freshly migrated database
- **WHEN** the app first runs
- **THEN** profile `id = 1` exists (seeded by migration or first-run logic)
