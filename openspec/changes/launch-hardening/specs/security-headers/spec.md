## ADDED Requirements

### Requirement: Baseline response headers
The application SHALL emit a baseline set of security headers on every HTTP
response, configured via `next.config.ts` `headers()`.

#### Scenario: HSTS
- **WHEN** any HTTP response leaves the server
- **THEN** the `Strict-Transport-Security` header is `max-age=63072000; includeSubDomains; preload`

#### Scenario: Framing protection
- **WHEN** any HTTP response leaves the server
- **THEN** the `X-Frame-Options` header is `DENY`

#### Scenario: MIME sniffing protection
- **WHEN** any HTTP response leaves the server
- **THEN** the `X-Content-Type-Options` header is `nosniff`

#### Scenario: Referrer policy
- **WHEN** any HTTP response leaves the server
- **THEN** the `Referrer-Policy` header is `strict-origin-when-cross-origin`

#### Scenario: Permissions policy
- **WHEN** any HTTP response leaves the server
- **THEN** the `Permissions-Policy` header denies `camera`, `microphone`, and `geolocation` by default

### Requirement: Content Security Policy
The application SHALL emit a Content-Security-Policy header on every HTML
response. The initial release SHALL deliver the policy in report-only mode and
flip to enforcing after a clean reporting window.

#### Scenario: Report-only policy
- **GIVEN** the launch-hardening change is in its initial deployment
- **WHEN** an HTML response leaves the server
- **THEN** a `Content-Security-Policy-Report-Only` header is present with `default-src 'self'`, `img-src 'self' data: https:`, `style-src 'self' 'unsafe-inline'`, `script-src 'self'`, `connect-src 'self' https://query1.finance.yahoo.com` plus the configured Sentry endpoint
- **AND** the policy includes a `report-uri` (or `report-to`) pointing at the configured CSP-report endpoint

#### Scenario: Enforcing policy after rollout
- **GIVEN** two weeks of clean CSP reports have elapsed
- **WHEN** the operator flips the enforcing toggle
- **THEN** the same policy is served as `Content-Security-Policy` instead of `Content-Security-Policy-Report-Only`

### Requirement: Session cookie flags
Every session cookie issued by Better Auth SHALL carry `HttpOnly`, `Secure` (in
production), and `SameSite=Lax`.

#### Scenario: Production cookie flags
- **GIVEN** `NODE_ENV === "production"`
- **WHEN** Better Auth issues a session cookie
- **THEN** the `Set-Cookie` header includes `HttpOnly; Secure; SameSite=Lax`

#### Scenario: Cookie flag self-check
- **WHEN** `GET /api/health` runs in production
- **THEN** the response body includes `cookies: "ok"` only when a probe session cookie carries all three flags
- **AND** otherwise the response includes `cookies: "misconfigured"` and the overall status is 503
