## MODIFIED Requirements

### Requirement: Supported sources
The system SHALL provide importers for: CMC Markets (`cmc`), Stake (`stake`),
Swyftx (`swyftx`), Independent Reserve (`ir`), and a generic XLSX format with a
sheet named `Tx`. Every importer SHALL validate file size and MIME type before
parsing.

#### Scenario: Source-specific endpoint
- **WHEN** an authenticated client `POST /api/import/<source>` with a file upload
- **THEN** the file is parsed using the source's parser, transactions are normalised to the canonical shape, and idempotently inserted
- **AND** the response includes `{ inserted: <n>, skipped: <n>, errors: [...] }`

#### Scenario: File exceeds size limit
- **GIVEN** an uploaded file whose `size` exceeds 5 * 1024 * 1024 bytes
- **WHEN** any importer route receives it
- **THEN** the response is HTTP 413 with `{ error: "File too large" }`
- **AND** no parsing is attempted

#### Scenario: Unsupported MIME type
- **GIVEN** an uploaded file whose `type` is not in the source's allowlist (`text/csv`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/pdf`, or `application/octet-stream` for known-binary CSVs)
- **WHEN** the importer route receives it
- **THEN** the response is HTTP 415 with `{ error: "Unsupported file type" }`
- **AND** no parsing is attempted

### Requirement: CMC email auto-import (IMAP)
The system SHALL poll an IMAP mailbox for CMC trade-confirmation emails only
when both the `EMAIL_POLL_ENABLED` feature flag is set to `"true"` AND the
corresponding CMC account mapping is `verified=true`. Attachment parsing SHALL
be bounded by size and timeout.

#### Scenario: Feature flag off
- **GIVEN** `EMAIL_POLL_ENABLED !== "true"`
- **WHEN** `GET /api/cron/email` runs with a valid `CRON_SECRET`
- **THEN** the response is `{ skipped: "feature disabled" }` and no IMAP connection is made

#### Scenario: GET /api/cron/email — happy path
- **GIVEN** `EMAIL_POLL_ENABLED === "true"` AND `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` are set
- **WHEN** a valid `CRON_SECRET` is supplied
- **THEN** the system connects via `imapflow`, scans unread CMC confirmation emails since the last `email_poll` cron-run timestamp, parses each email body/PDF attachment with `cmc-email-parser.ts`
- **AND** maps the CMC account number to a profile only when `cmc_account_mappings.verified = true`
- **AND** inserts the parsed transaction(s) for that profile, idempotently
- **AND** marks the email as read on success

#### Scenario: Attachment size cap
- **GIVEN** an email attachment whose buffer length exceeds 5 * 1024 * 1024 bytes
- **THEN** the attachment is skipped without invoking `pdf-parse`
- **AND** the email is left unread and the skip is recorded in the response `errors`

#### Scenario: Parse timeout
- **GIVEN** `simpleParser` or `pdf-parse` takes longer than 10 seconds for a single message
- **THEN** the parse is aborted via `Promise.race` with a timeout
- **AND** the email is left unread and the timeout is recorded in the response `errors`

#### Scenario: Account number not verified
- **GIVEN** a confirmation email whose CMC account number exists in `cmc_account_mappings` with `verified=false`
- **THEN** the email is left unread and the response records "mapping unverified"
- **AND** no transaction is inserted

#### Scenario: Account number with no mapping
- **GIVEN** a confirmation email's CMC account number is not in `cmc_account_mappings`
- **THEN** the email is left unread, an error is recorded in the response, and no transaction is inserted

## ADDED Requirements

### Requirement: CMC account mapping verification
A `cmc_account_mappings` row SHALL be considered active for IMAP ingestion only
after the user has proved ownership of the CMC account number by uploading a
sample CMC trade-confirmation PDF whose embedded account number matches.

#### Scenario: Verify endpoint
- **WHEN** an authenticated user `POST /api/settings/cmc-accounts/{id}/verify` with a PDF body whose embedded CMC account number matches the mapping's `cmcAccountNumber`
- **AND** the mapping's profile is owned by the user
- **THEN** the row's `verified` column is set to `true` and the response is HTTP 200

#### Scenario: Verification mismatch
- **WHEN** the uploaded PDF's embedded account number does not match the mapping's `cmcAccountNumber`
- **THEN** the response is HTTP 400 and the mapping remains `verified=false`

#### Scenario: Pre-existing mappings backfill
- **GIVEN** the migration that adds `verified` to `cmc_account_mappings`
- **WHEN** the migration runs
- **THEN** every existing row is set to `verified = false` (operator must manually re-verify before re-enabling the feature)
