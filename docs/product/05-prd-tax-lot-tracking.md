# PRD — Tax-Lot Tracking & CGT Reporting

| | |
| --- | --- |
| Status | Draft for review |
| Owner | (me) |
| Authors | (me) |
| Reviewers | — |
| Target release | v1.0 (the wedge feature for [Fork C](./03-product-strategy.md)) |
| Related | [`openspec/specs/transactions/spec.md`](../../openspec/specs/transactions/spec.md), [`openspec/specs/holdings/spec.md`](../../openspec/specs/holdings/spec.md) |

## TL;DR

Today the app stores transactions and computes an *average* cost basis per asset. That is fine for "is my portfolio up?" but it is wrong for Australian capital-gains-tax reporting, which requires per-parcel (lot) tracking with a defensible disposal method (FIFO, LIFO, or specific identification). Without lot tracking, the user cannot produce a CGT report, which is the single most important thing that keeps Sharesight users paying. This PRD scopes adding lot tracking and a year-end CGT report.

## Problem

> *"At tax time, I export trades from this app, then spend an evening matching parcels to disposals in a spreadsheet so my accountant doesn't bill me four hours doing the same thing. The app already has every trade — it should be doing the matching."*

Australian CGT requires that each disposal (sale) be matched to one or more acquisitions (parcels). The taxable gain is the disposal price minus the parcel cost base, and is discounted 50% if the parcel was held > 12 months. The choice of *which parcel* to match against a partial disposal is the user's, subject to ATO rules. Average-cost reporting is not accepted for shares (it is for some managed funds — different regime).

The current model collapses this to a running average. Information is lost the moment a sale occurs. Reconstructing it from history is expensive but not impossible — see Open Question #3.

## Who this is for

Primary: the AU multi-platform investor described in [discovery](./01-discovery.md). They lodge their own return or share a CSV with an accountant. They have at least one disposal per year.

Secondary: the accountant receiving their CSV. They want columns matching the ATO supplementary section, sorted by acquisition date.

## Goals

| # | Goal | Measure |
| --- | --- | --- |
| G1 | Compute taxable capital gains per disposal, with the long-term discount applied where eligible | Output matches a hand-computed reference for a 30-trade test portfolio within $1 |
| G2 | Let users choose disposal method per sale (FIFO default, LIFO, specific lot selection) | UI lets user pick; selection persists across recomputes |
| G3 | Export a CSV report compatible with what an Australian accountant expects at tax time | Format reviewed by 1 practising accountant before ship |
| G4 | Backfill lots from existing transaction history without losing the current dashboard | Existing user can run a one-shot migration; dashboard numbers unchanged ±$0.01 |

## Non-goals

- **Tax filing** itself. We export; the user lodges (or their accountant does).
- **Other jurisdictions** (US 1099, UK Section 104). Adds complexity for zero current benefit.
- **Trust / SMSF / company reporting.** Different regimes. Out of v1.
- **Crypto on-chain capital events** (chain splits, hard forks, staking yield). The CGT treatment is unsettled in places; defer.
- **Wash-sale rules.** AU doesn't have a strict wash-sale regime like the US; out of scope.
- **Realised income** other than capital gains (dividends are tracked separately as `DIV` action; treated as income, not CGT).

## User stories

> **As an AU investor**, when I view a holding with a long history, I want to see each parcel separately with its acquisition date, quantity, and cost base, so I can plan disposals to maximise the long-term discount.

> **As an AU investor**, when I record a partial sale, I want the app to assign the disposal to specific parcels (FIFO by default, with override), so the report is defensible at tax time.

> **As an AU investor**, in June, I want to export a CGT summary for the financial year, so I can hand it to my accountant or paste it into the supplementary section.

> **As an accountant**, I want a CSV with disposal date, acquisition date, parcel quantity, cost base, proceeds, gain/loss, and discount eligibility flag, sorted by acquisition date, so I can reconcile against what the client tells me.

## Proposed solution

### Data model changes

Two new concepts: **lot** (an acquisition with remaining quantity) and **disposal_match** (a sale matched against one or more lots).

```
lots
  id, transaction_id (FK to the BUY/DIV-reinvested transaction), asset_id,
  acquisition_date, quantity_acquired, cost_base_aud,
  quantity_remaining (denormalised, recomputed from disposal_matches)

disposal_matches
  id, sale_transaction_id (FK to SELL transaction), lot_id, quantity_matched,
  proceeds_aud (allocated proportionally), method ('FIFO' | 'LIFO' | 'SPECIFIC')
```

The existing `transactions` table is the source of truth. `lots` and `disposal_matches` are derived state, rebuildable from transactions. This matches the codebase's existing pattern of preferring derived computation.

### UI

Three additions:

1. **Holding detail page** gains a "Parcels" tab. Lists each open lot with date, quantity, cost base, and "long-term eligible" flag. Sortable.
2. **Sale entry form** shows a lot-picker when the asset has multiple parcels. Default is FIFO with a "use FIFO" checkbox; uncheck to manually allocate.
3. **New page `/tax`** with a financial-year selector (defaulting to current AU FY: 1 Jul – 30 Jun) and a "Download CGT CSV" button.

### Algorithms

- **FIFO matching** (default): walk lots oldest-first, consume until the sale quantity is satisfied.
- **LIFO matching**: same, newest-first.
- **Specific identification**: user supplies the allocation; UI prevents over-allocation.
- **Long-term discount eligibility** per parcel: `(disposal_date - acquisition_date) >= 365 days`. (Strictly: > 12 months. Edge cases at 365 vs 366 days handled per ATO guidance — flagged as open question #2.)
- **Cost base apportionment** for partial sales: proportional to quantity matched.

## Trade-offs considered

### Option 1: FIFO-only, no UI

Cheapest. Defensible default for most users. Hides flexibility.

- *Pro.* Ships in a week. Matches what 80% of users would do anyway.
- *Con.* Power users want to optimise; we lose them to Sharesight. Specifically: a user who wants to dispose of a long-term parcel to harvest the discount can't do so without exporting and re-importing.
- *Verdict.* Insufficient for the wedge. Tax-aware investors *are* the segment.

### Option 2: Full lot tracking with method-per-disposal *(chosen)*

What's described above. FIFO default, user can override per sale.

- *Pro.* Matches the actual decision space. Defensible. Maps cleanly to ATO expectations.
- *Con.* More UI; backfill from history requires care.
- *Verdict.* Right scope for the wedge.

### Option 3: Integrate with Sharesight tax export

Have users export from Sharesight, import here for everything else.

- *Pro.* Free-rides on Sharesight's tax engine.
- *Con.* Defeats the strategic purpose entirely. Users still pay Sharesight; we add no value at tax time.
- *Verdict.* Rejected.

### Option 4: Outsource via accountant tool integration

Generate a Xero / MYOB / accounting-package compatible export.

- *Pro.* Strong story for accountants.
- *Con.* Out of scope for v1; heavier compliance surface; smaller user segment cares.
- *Verdict.* Defer to v2.

## Rollout

1. **Behind a feature flag** (`PORTFOLIO_TAX_FEATURES=true`). Default off.
2. **Backfill migration script.** For each asset with existing transactions, generate `lots` from BUYs in date order and `disposal_matches` from SELLs using FIFO. Preserve existing `total_aud` and `adjusted_qty` exactly (regression test).
3. **Internal dogfood.** Run against my own portfolio for one quarter before exposing to anyone else. Compare CGT export to a hand-computed expected output.
4. **Closed beta** with 5 waitlist signups (per [GTM](./04-gtm-strategy.md)). Review their exports against their accountants' expectations.
5. **General availability** as paid tier (per [strategy](./03-product-strategy.md), Fork C option).

## Success criteria

- G1 (accuracy): produce a CGT report for the test portfolio that matches the hand-computed reference within $1, including discount logic. Hard gate.
- G2 (flexibility): a user can switch a sale from FIFO to specific-identification and the report updates. Soft gate (manual QA).
- G3 (CSV format): one practising accountant signs off that the format is usable. Hard gate before paid-tier launch.
- G4 (backfill safety): dashboard P/L unchanged ±$0.01 after migration. Hard gate.

## Open questions

1. **License for the tax module.** Open-source or paid-tier-only? [03 — strategy](./03-product-strategy.md) leans paid. Decision needed before code lands.
2. **Discount eligibility edge cases.** ATO uses "more than 12 months", which is calendar-month-aware, not 365-day-aware. Confirm exact semantics with a tax practitioner before locking the algorithm.
3. **Backfill: SELLs with no matching BUY history.** What if a user imports SELLs older than their BUYs (e.g. they only have records from 2020 onwards but sold something they bought in 2010)? Options: prompt for a manual cost base, or refuse to compute CGT for that disposal and flag.
4. **CHESS-sponsored vs custodial holdings** for ASX. Different broker paperwork, but for CGT the parcel is the parcel. Should be a non-issue but worth confirming.
5. **Crypto staking rewards as acquisitions.** Treated as ordinary income at receipt with cost base = market value at receipt. Out of v1, but the data model should not preclude it.
6. **Currency conversion at disposal.** AUD cost base is stored at acquisition FX rate; ATO requires AUD valuation at disposal date too. The current `unitPriceAud` is already AUD-at-trade-date, so this should work — but worth a double-check with a real cross-currency disposal in the test portfolio.

## Estimate (5 hr/wk)

| Block | Effort |
| --- | --- |
| Schema + migration | 1 week |
| Backfill + regression test | 1 week |
| FIFO/LIFO computation | 1 week |
| Specific-identification UI | 2 weeks |
| `/tax` page + CSV export | 1 week |
| Accountant review + iteration | 1 week |
| Edge-case clean-up + dogfood | 2 weeks |
| **Total** | **~9 weeks** |

That's the optimistic line. Realistic with discovery interruptions: ~12 weeks. Sized this way deliberately — no theatrical hockey-stick. If it's worth doing, it's worth doing accurately.

## Why this PRD is the format it is

I've kept it short on purpose. PRDs should be one document an engineer can read in 10 minutes and start working from. Long PRDs read as design docs in disguise; design docs belong in [`openspec/changes/`](../../openspec/changes/) when this PRD becomes a change. Open questions are explicit because they are the things I'd actually need a stakeholder call to resolve before I commit a sprint.
