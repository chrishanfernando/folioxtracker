## ADDED Requirements

### Requirement: Boundary validation with zod
Every mutating API route handler under `src/app/api/**/route.ts` SHALL validate
its request body with a zod schema before any DB read or write. Routes that
read request bodies without validation SHALL be considered defects.

#### Scenario: Valid payload
- **WHEN** an authenticated client `POST /api/transactions` with a body matching the schema
- **THEN** the handler proceeds to its business logic
- **AND** the parsed object — not the raw JSON — is used downstream

#### Scenario: Invalid payload — wrong types
- **WHEN** an authenticated client `POST /api/transactions` with `{ quantity: "abc" }`
- **THEN** the response is HTTP 400 with `{ error: "Invalid request", requestId: "<uuid>" }`
- **AND** no DB write occurs
- **AND** the zod issue list is logged server-side with the request_id

#### Scenario: Invalid payload — missing required field
- **WHEN** any mutating route receives a body missing a required field
- **THEN** the response is HTTP 400 with the same sanitised envelope

#### Scenario: Invalid payload — extra unknown field
- **GIVEN** the route's zod schema uses `.strict()` or `.passthrough()` per design
- **WHEN** a payload includes an unrecognised field on a `.strict()` schema
- **THEN** the response is HTTP 400

### Requirement: Shared validation primitives
A central `src/lib/validation/primitives.ts` module SHALL export reusable zod
helpers so each route's schema does not redefine constraints from scratch.

#### Scenario: Currency amount
- **GIVEN** the `aud` primitive
- **THEN** it accepts numbers ≥ 0, finite, and rejects `NaN`, `Infinity`, and strings

#### Scenario: Quantity
- **GIVEN** the `qtyDecimal` primitive
- **THEN** it accepts non-negative finite numbers and rejects negatives, `NaN`, and strings

#### Scenario: ISO date string
- **GIVEN** the `isoDate` primitive
- **THEN** it accepts strings matching `^\d{4}-\d{2}-\d{2}$` and rejects everything else

#### Scenario: Action enum
- **GIVEN** the `transactionAction` primitive
- **THEN** it accepts only `"buy"`, `"sell"`, `"dividend"`, `"split"`

#### Scenario: Bounded string
- **GIVEN** the `sanitizedString(maxLen)` primitive
- **THEN** it accepts strings with `0 < length ≤ maxLen` and rejects strings outside that range

### Requirement: File-upload validation
File uploads SHALL be validated for size and MIME type at the route boundary
before any parsing library is invoked. See the Import spec for the source-by-
source allowlist.

#### Scenario: Size exceeded
- **WHEN** any importer route receives a file whose `size` exceeds 5 MB
- **THEN** the response is HTTP 413 and no parser is called

#### Scenario: Unknown MIME
- **WHEN** any importer route receives a file whose `type` is not in the allowlist
- **THEN** the response is HTTP 415 and no parser is called

### Requirement: Validation coverage check
The project SHALL maintain a check (script or test) that fails the build when a
mutating API route lacks a zod schema. The check guards against regressions
where a new route ships without validation.

#### Scenario: New route without schema
- **GIVEN** a freshly added `POST` / `PATCH` / `DELETE` handler under `src/app/api/`
- **WHEN** the coverage check runs in CI
- **THEN** the check fails with a message naming the file and exits non-zero
