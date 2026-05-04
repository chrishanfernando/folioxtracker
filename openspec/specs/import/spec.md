# Import Specification

## Purpose

Ingest transaction history from external brokers and exchanges so the user does not have to enter trades manually. Supports file upload (CSV / XLSX / PDF) and IMAP polling for CMC Markets trade-confirmation emails. All imports normalise to AUD and write into the `transactions` table for the active (or mapped) profile.

## Requirements

### Requirement: Supported sources
The system SHALL provide importers for: CMC Markets (`cmc`), Stake (`stake`), Swyftx (`swyftx`), Independent Reserve (`ir`), and a generic XLSX format with a sheet named `Tx`.

#### Scenario: Source-specific endpoint
- **WHEN** an authenticated client `POST /api/import/<source>` with a file upload
- **THEN** the file is parsed using the source's parser, transactions are normalised to the canonical shape, and idempotently inserted
- **AND** the response includes `{ inserted: <n>, skipped: <n>, errors: [...] }`

### Requirement: Ticker resolution
The system SHALL map source-specific symbols to internal asset rows.

#### Scenario: Known mapping
- **GIVEN** `ticker-map.ts` contains `BHP → asset id 42` for CMC
- **WHEN** a CMC row references `BHP`
- **THEN** the resulting transaction is linked to asset id 42

#### Scenario: Unknown symbol
- **GIVEN** an imported row whose symbol is not in the source's ticker map and not in `ASSET_MAP`
- **THEN** the row is reported in `errors` with the unrecognised symbol; no transaction is created
- **AND** the rest of the file continues to import

### Requirement: Idempotency
Imports SHALL not create duplicate transactions when the same file is uploaded twice.

#### Scenario: Re-upload
- **GIVEN** a file was previously imported with no errors
- **WHEN** the same file is uploaded again
- **THEN** every row is matched against existing transactions on `(assetId, date, action, quantity, unit_price_aud)` and skipped if matched
- **AND** the response reports `inserted: 0` and `skipped: <total rows>`

### Requirement: CMC email auto-import (IMAP)
The system SHALL poll an IMAP mailbox for CMC trade-confirmation emails when configured.

#### Scenario: GET /api/cron/email
- **WHEN** a valid `CRON_SECRET` is supplied AND `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` are set
- **THEN** the system connects via `imapflow`, scans unread CMC confirmation emails since `settings.lastEmailPoll`, parses each email body/PDF attachment with `cmc-email-parser.ts`
- **AND** maps the CMC account number to a profile via `cmc_account_mappings`
- **AND** inserts the parsed transaction(s) for that profile, idempotently
- **AND** marks the email as read on success
- **AND** updates `settings.lastEmailPoll` to the current timestamp

#### Scenario: IMAP not configured
- **GIVEN** any of `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` is missing
- **THEN** the cron endpoint returns `{ skipped: "imap not configured" }` with HTTP 200 and does not fail

#### Scenario: Account number with no mapping
- **GIVEN** a confirmation email's CMC account number is not in `cmc_account_mappings`
- **THEN** the email is left unread, an error is recorded in the response, and no transaction is inserted

### Requirement: Excel format for legacy data
The system SHALL accept a workbook with a `Tx` sheet matching the legacy spreadsheet layout.

#### Scenario: Tx sheet missing
- **GIVEN** an uploaded XLSX without a sheet named `Tx`
- **THEN** the response is HTTP 400 with `{ error: "No \"Tx\" sheet found in workbook" }`
