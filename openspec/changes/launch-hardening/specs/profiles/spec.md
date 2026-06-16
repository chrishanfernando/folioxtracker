## MODIFIED Requirements

### Requirement: Profile CRUD
The system SHALL expose endpoints to list, rename, and create profiles, scoped
to the authenticated user. Every `profiles` row SHALL have a non-null `user_id`.

#### Scenario: List profiles
- **WHEN** an authenticated user `U` issues `GET /api/profiles`
- **THEN** the response is an array of `{ id, name, createdAt, userId }` for every row in `profiles` where `user_id = U`

#### Scenario: Create a profile
- **WHEN** an authenticated user `U` issues `POST /api/profiles` with `{ name: "<non-empty>" }`
- **THEN** a row is inserted with `created_at = today (YYYY-MM-DD)` and `user_id = U`
- **AND** the request body is validated by zod — `name` must be a non-empty string of length ≤ 64

#### Scenario: Rename a profile owned by someone else
- **WHEN** user `U₂` issues `PATCH /api/profiles` with `{ id: P, name: "..." }` where `P` is owned by `U₁`
- **THEN** the response is `{ error: "Profile not found" }` with HTTP 404
- **AND** the row is unchanged

#### Scenario: Schema enforces NOT NULL user_id
- **GIVEN** the migration that strengthens `profiles.user_id` to NOT NULL has run
- **WHEN** any subsequent INSERT attempts a row without `user_id`
- **THEN** the database rejects the insert
- **AND** the application's Drizzle schema reflects the NOT NULL constraint at the type level

## ADDED Requirements

### Requirement: Pre-NOT-NULL safety check
The drizzle migration that strengthens `profiles.user_id` to NOT NULL SHALL
refuse to apply when any orphan row exists, so an unmigrated install is not
silently corrupted.

#### Scenario: Orphans detected
- **GIVEN** the migration runs and `SELECT count(*) FROM profiles WHERE user_id IS NULL` returns > 0
- **THEN** the migration aborts with a readable error instructing the operator to run `scripts/migrate-to-multiuser.ts --owner-email <addr> --commit` first
- **AND** no schema change is applied

### Requirement: Multi-user migration script safety
The `scripts/migrate-to-multiuser.ts` helper SHALL not silently re-parent orphan
profiles. It SHALL require an explicit owner argument and a separate commit
flag.

#### Scenario: Dry run by default
- **WHEN** the script is invoked without `--commit`
- **THEN** the script prints what it would do and exits 0 without writing

#### Scenario: Missing --owner-email
- **WHEN** the script is invoked with `--commit` but no `--owner-email`
- **THEN** the script aborts with `Error: --owner-email is required` and exits non-zero

#### Scenario: Owner not found
- **WHEN** the script is invoked with `--commit --owner-email foo@example.com` and no user has that email
- **THEN** the script aborts and exits non-zero, writing nothing

#### Scenario: Ambiguous orphan-to-user mapping
- **WHEN** the script is invoked with `--commit --owner-email foo@example.com` and more than one user exists
- **THEN** the script requires that the target user explicitly own the orphan profiles (no implicit "the only user" branch)
- **AND** orphan profiles are assigned only to the user matching `--owner-email`
