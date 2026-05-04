# Settings Specification

## Purpose

Manage app-wide configuration: password change, notification email, email-notifications toggle, last-run timestamps for cron jobs, and the CMC-account → profile mapping table used by the IMAP importer. The `settings` table is a singleton (one row).

## Requirements

### Requirement: Read settings
The system SHALL expose the current settings (without secrets) to authenticated clients.

#### Scenario: GET /api/settings
- **WHEN** an authenticated client requests settings
- **THEN** the response is `{ email, emailNotifications, lastPriceFetch, lastRebalanceCheck, lastEmailPoll }`
- **AND** `password_hash` is never returned

#### Scenario: First-time
- **GIVEN** no `settings` row exists
- **THEN** the response is `{ needsSetup: true }`

### Requirement: Update settings
The system SHALL accept partial updates to email and emailNotifications, and a guarded password change.

#### Scenario: Update email and notifications
- **WHEN** an authenticated client `PUT /api/settings` with `{ email, emailNotifications }`
- **THEN** the singleton row is updated and the response is HTTP 200

#### Scenario: Password change without current password
- **WHEN** the client supplies `newPassword` without `currentPassword`
- **THEN** the response is HTTP 400 and the password is unchanged

#### Scenario: Password change with wrong current password
- **WHEN** `currentPassword` does not match
- **THEN** the response is HTTP 401 and the password is unchanged

### Requirement: CMC account mappings
The system SHALL expose CRUD for the `cmc_account_mappings` table.

#### Scenario: List mappings
- **WHEN** an authenticated client `GET /api/settings/cmc-accounts`
- **THEN** the response is `[{ id, cmcAccountNumber, profileId, label }]`

#### Scenario: Create mapping
- **WHEN** an authenticated client `POST /api/settings/cmc-accounts` with `{ cmcAccountNumber, profileId, label? }`
- **THEN** a row is inserted; if the account number already exists the response is HTTP 409

#### Scenario: Delete mapping
- **WHEN** an authenticated client `DELETE /api/settings/cmc-accounts/{id}`
- **THEN** the row is deleted

### Requirement: Notification dispatch
The system SHALL only send email when notifications are enabled and Resend is configured.

#### Scenario: Notification gate
- **GIVEN** `emailNotifications = true` AND `settings.email` is set AND `RESEND_API_KEY` is set
- **THEN** the system MAY send transactional emails (rebalance alerts, etc.)

#### Scenario: Notifications disabled
- **GIVEN** `emailNotifications = false` OR `email` is empty OR `RESEND_API_KEY` is not set
- **THEN** the system SHALL NOT attempt to send email and SHALL NOT error

### Requirement: Cron timestamps
The system SHALL update `lastPriceFetch`, `lastRebalanceCheck`, and `lastEmailPoll` whenever the corresponding cron endpoint runs to completion.

#### Scenario: Successful cron run
- **THEN** the relevant timestamp is set to the current ISO timestamp at the end of the handler
