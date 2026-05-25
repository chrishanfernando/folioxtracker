# 02 — Competitive Analysis

> **Status:** Snapshot as of 2026-05. Pricing and feature claims drawn from publicly visible vendor pages; verify before quoting in any commercial context.

## Why this exists

To answer two questions: *(a) is this problem already well-served?* and *(b) where, specifically, is the gap I'm building toward?* If the answer to (a) is "yes, by Sharesight" and the gap in (b) is small, the strategic answer is "keep it personal" — see [03 — Product strategy](./03-product-strategy.md).

## The competitive set

I bucketed the market into four groups based on what they actually do.

### Group A — Full-stack portfolio + tax (AU-focused)

**Sharesight.** The dominant Australian tool. Subscription SaaS, ~A$25–A$45/mo depending on tier. Auto-imports from most ASX brokers via email/CSV; supports US tickers; produces ATO-shaped CGT reports. Cloud-only — credentials and trade history live with them.

- *Strengths.* Mature, wide broker coverage, accountant-friendly tax exports, mobile app.
- *Weaknesses.* SaaS-only (privacy concern for some), expensive at scale, weak crypto coverage (improving), no self-host.

**Navexa.** Australian competitor, similar shape. Thinner broker coverage but cheaper.

### Group B — Global portfolio trackers (US-default)

**Snowball Analytics, Stockfolio, Empower (formerly Personal Capital), Kubera.** US/global tools. Strong dashboards, pretty UIs, dividend tracking. None of them are AUD-native — you can show AUD, but tax features and FX handling are first-class for USD investors and bolted-on for everyone else.

- *Strengths.* Polished UX; some support brokerage account aggregation via Plaid/Yodlee.
- *Weaknesses.* Not built for AU CGT; weak ASX support; aggregation services don't reliably cover AU brokers; subscription priced in USD.

### Group C — Crypto-only

**CoinTracker, Koinly, CryptoTaxCalculator (AU).** Crypto-specific portfolio + tax. Good at on-chain ingest. Don't track equities at all.

- *Strengths.* On-chain, exchange APIs, deep coverage of the wallets and exchanges I don't even know exist.
- *Weaknesses.* You still need a separate equities tracker. Tax tools, not glance-tools.

### Group D — Spreadsheets

**Google Sheets / Excel.** What I was using before I built this. Realistic incumbent.

- *Strengths.* Free, total control, integrates with anything via CSV.
- *Weaknesses.* Brittle. FX has to be wired manually. No charts without effort. No mobile.

## Feature comparison

A coarse matrix focused on the dimensions that drove my own switch away from each option.

| Capability | This app | Sharesight | Snowball / global | Koinly etc. | Spreadsheet |
| --- | --- | --- | --- | --- | --- |
| AUD-native (everything in AUD) | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ DIY |
| ASX equities | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| US equities | ✅ | ✅ | ✅ | ❌ | ✅ |
| Crypto (multiple exchanges) | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ DIY |
| Gold / commodities | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ DIY |
| Multi-profile (e.g. personal + SMSF) | ✅ | ✅ paid tier | ⚠️ | ⚠️ | DIY |
| AU CGT report | ❌ planned | ✅ | ❌ | ✅ crypto only | ⚠️ DIY |
| Daily prices auto | ✅ | ✅ | ✅ | ✅ | ❌ |
| Self-hostable | ✅ | ❌ | ❌ | ❌ | n/a |
| Email auto-import (CMC) | ✅ | ✅ | ❌ | n/a | ❌ |
| Buy-only rebalance recommendations | ✅ | ❌ | ❌ | ❌ | DIY |
| Category targets + drift | ✅ | ⚠️ | ⚠️ | ❌ | DIY |
| Cost | $0 (self-host) | A$25–45/mo | US$10–30/mo | $50–200/yr | $0 |

## Where I sit

Relative to the field, this app has three things that aren't widely co-located:

1. **AUD-native AND multi-asset (equities + crypto + gold) AND multi-profile** — Sharesight is closest but their crypto support is thin and they're SaaS-only.
2. **Self-hostable** — you keep the data; nobody else does this in this category.
3. **Buy-only rebalance reframing** — none of the trackers I evaluated frame rebalance around new cash deployment instead of liquidating to target. This matters for AU CGT-aware investors specifically.

It is *missing* the thing that makes Sharesight stick: a CGT report. That's the obvious next product bet — see [05 — PRD: tax-lot tracking](./05-prd-tax-lot-tracking.md).

## Positioning hypothesis (to be tested)

> *For Australian retail investors with a multi-platform portfolio who don't want to give a SaaS their brokerage credentials, this is the AUD-native tracker that runs on your own machine and tells you where to put new money to stay on target.*

The boundaries of that statement are deliberately tight:

- **"Australian"** — AUD-base, ASX, AU CGT context.
- **"Multi-platform"** — kicks out the single-broker users who'll happily use the broker's own dashboard.
- **"Don't want SaaS"** — kicks out the majority who *do* want SaaS; that's where I lose to Sharesight, and it's a deliberate cut.
- **"Where to put new money"** — kicks out the casual users who don't rebalance.

That's a small segment. It's also a segment I can name, find on Reddit, and describe in two sentences — which is what positioning should be able to do.

## What would change my read

- If Sharesight ships a self-host or local-data tier, the privacy moat collapses.
- If a new entrant ships a polished open-source AU-focused tracker (Ghostfolio is the closest existing OSS option globally; an AU fork is plausible), the OSS angle weakens.
- If broker open-banking APIs (CDR) mature to give read-only direct-from-broker imports, the "file upload" workflow becomes a liability rather than a feature.

I track these in the [roadmap](./08-roadmap.md) under "watch list".

## Sources

Vendor websites visited 2026-05; pricing tiers as displayed publicly. Reddit threads on /r/AusFinance, /r/AusCorp, /r/AusFinanceLeftWing for incumbent sentiment and switching reasons. ATO 2025 statistical bulletin for retail investor population sizing. None of this is a substitute for primary user research, which is the next step.
