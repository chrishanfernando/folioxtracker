# ADR 0005 — Holdings as derived state, not a materialised table

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-03-04 |
| Deciders | (me) |

## Context

The dashboard, holdings list, and charts all need an answer to "what is my current position in each asset, with cost basis and market value?" Two ways to model this:

- **Materialised:** maintain a `holdings` table that is updated whenever a transaction or price changes.
- **Derived:** compute holdings on demand from `transactions` + `prices`.

## Decision

**Holdings are derived.** No `holdings` table. [`src/lib/calculations.ts`](../../src/lib/calculations.ts) walks the transaction ledger and the latest prices to produce holdings on every dashboard load.

## Consequences

**Accepted.**

- One source of truth: transactions. Anything wrong with a holding is fixable by editing or adding a transaction.
- No invalidation logic. No stale-cache class of bugs. No "did the trigger fire?" debugging at 11 pm.
- Recomputing is fast at this data scale (a personal portfolio is hundreds of transactions, not millions). On the Pi, dashboard load is well under a second.
- Refactors of the calculation logic don't require migrations. Everything is read-side.

**Trade-offs accepted.**

- At very large scale (10s of thousands of transactions per profile, multi-decade history), the dashboard load would slow noticeably. Not a problem at retail scale; would matter for an institutional product.
- Some calculations (CAGR, value history) need to walk every transaction every time. We accept the cost; if it ever bites, we'll cache, not materialise.
- The "what was my portfolio worth on 2024-12-31?" query has to recompute holdings as of that date. The current code does this by filtering transactions ≤ that date and forward-filling prices. The pattern works.

## Alternatives considered

- **Materialised holdings table updated by triggers.** Faster reads. Rejected: the maintenance complexity (price update touches every holding row; transaction edit cascades; backfill semantics) outweighs the read-speed benefit at this scale.
- **Cache layer with TTL.** A halfway compromise. Rejected: cache invalidation is the harder problem; not worth it for a sub-second baseline.
- **Snapshot table updated nightly.** Reasonable for *historical* queries (value-at-date series). May be added later if dashboard latency degrades. Doesn't replace derived; supplements it.

## Revisit if

- A single dashboard load takes longer than 1 second on the Pi for a realistic portfolio.
- Tax features (per [PRD 05](../product/05-prd-tax-lot-tracking.md)) introduce per-parcel tracking that turns out to be expensive to derive every time. Even there, the lots table is *itself* derived from transactions; the question is whether to cache the derivation.
