# Email Deliverability Setup

Status: **code changes done; DNS + Resend dashboard work outstanding.**

The app's email senders ([src/lib/email.ts](../src/lib/email.ts)) now require a verified sending domain — `EMAIL_FROM` no longer falls back to the Resend sandbox. Until the steps below are completed, verification, password-reset, and rebalance-alert emails will fail in any environment where `EMAIL_FROM` is unset, and would land in spam if pointed at an unverified domain.

## What's already done (in this PR)

- Removed `portfolio@resend.dev` fallback in [src/lib/email.ts](../src/lib/email.ts) — `getFrom()` now throws if `EMAIL_FROM` is missing.
- Added `replyTo` (from `EMAIL_REPLY_TO`) on all sends.
- Added plain-text `text:` body alongside `html:` on all three templates (multipart improves spam scoring).
- Added optional `List-Unsubscribe` + one-click header on rebalance alerts (gated on `EMAIL_UNSUBSCRIBE_MAILTO`).
- Updated [.env.example](../.env.example) with the new vars and a warning comment.

## What's left to do

### 1. Pick a sending domain
- Use a dedicated subdomain (recommended: `mail.yourdomain.com` or `notifications.yourdomain.com`) so transactional reputation is isolated.
- Decide the From address, e.g. `Portfolio Tracker <no-reply@mail.yourdomain.com>`.
- Decide a Reply-To you actually monitor (e.g. `support@yourdomain.com`).

### 2. Add the domain in Resend
- Resend dashboard → **Domains → Add Domain** → enter the subdomain, region `us-east-1` (or closest).
- Resend will display the DNS records to publish.

### 3. Publish DNS records at your registrar
At your DNS provider (Cloudflare/Namecheap/Route 53), add **exactly** what Resend shows — don't hand-write SPF/DKIM values:
- **SPF** (TXT on the sending domain): typically `v=spf1 include:amazonses.com ~all`.
- **DKIM** (3 CNAMEs Resend provides, `resend._domainkey…` style). All three must resolve.
- **MX** — only if you want bounce/inbound handling on that subdomain.
- **DMARC** (TXT on `_dmarc.yourdomain.com`). Start permissive, tighten over time:
  - Week 1: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; fo=1`
  - After 1–2 weeks of clean reports: `p=quarantine; pct=25` → `pct=100` → `p=reject`.
- Wait for Resend dashboard to mark the domain **Verified** (usually <1 hr; can take up to 24).

### 4. Wire env vars in deploy target (Vercel/Fly/etc.)
Set these in production (and preview, if you want previews to send real mail):

```
EMAIL_FROM="Portfolio Tracker <no-reply@mail.yourdomain.com>"
EMAIL_REPLY_TO=support@yourdomain.com
EMAIL_UNSUBSCRIBE_MAILTO=unsubscribe@yourdomain.com
RESEND_API_KEY=<sending-only key for prod; separate key for dev/preview>
```

Use a Resend **Sending-only** API key for prod. Keep dev/preview on a separate key so you can revoke independently.

### 5. Pre-flight deliverability test
- Send each template (`sendVerificationEmail`, `sendPasswordResetEmail`, `sendRebalanceAlert`) to **mail-tester.com** — aim for 9+/10.
- Send to a Gmail, an Outlook, and a Yahoo inbox; confirm not in spam, and check headers show `SPF=pass DKIM=pass DMARC=pass`.

### 6. Post-launch monitoring
- Enable Resend webhooks (`bounced`, `complained`, `delivery_delayed`) → log them; auto-suppress hard-bounced addresses so reputation stays clean.
- Watch the DMARC `rua` mailbox for the first couple of weeks before tightening to `p=reject`.

### 7. Optional but worth it
- BIMI record + verified VMC logo (after DMARC is at `p=reject`) — shows your logo in Gmail.
- TLS-RPT and MTA-STS for the subdomain.

## Quick verification commands

After publishing DNS, confirm records resolve before clicking "Verify" in Resend:

```sh
dig +short TXT mail.yourdomain.com           # SPF
dig +short CNAME resend._domainkey.mail.yourdomain.com  # DKIM (repeat for the other two)
dig +short TXT _dmarc.yourdomain.com         # DMARC
```
