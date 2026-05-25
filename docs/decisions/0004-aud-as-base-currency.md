# ADR 0004 — AUD as the only base currency

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-03-04 |
| Deciders | (me) |

## Context

The portfolio includes ASX equities (AUD), US equities (USD), crypto (mixed pairs), and gold futures (USD). A cross-asset dashboard requires picking one base currency and converting everything to it.

Two architectural choices were possible: (a) store everything in its native currency and convert at read time, or (b) convert at write time and store everything pre-converted.

## Decision

**Store everything in AUD.** Every transaction has a `unit_price_aud` and `total_aud` populated at write time, using the FX rate that applied at the trade date. The original-currency context (`unit_price_local`, `local_currency`, `fx_rate`) is preserved alongside but is informational, not used for any aggregation.

## Consequences

**Accepted.**

- Reads are simple. Dashboard, holdings, charts, rebalance — all sum AUD columns. No FX joins, no time-of-read FX reconciliation.
- The trade-time FX rate is captured permanently. This matches what an Australian tax return needs (AUD value at trade date), so when tax features ship, the data is already in the right shape.
- The product can claim "AUD-native" honestly. Every screen, every export, every recommendation is in AUD with no caveats.

**Trade-offs accepted.**

- A user in NZ who wants NZD-native reporting cannot use this app without modification. NZD support is a v2 candidate (see [`docs/product/08-roadmap.md`](../product/08-roadmap.md)).
- If FX rates need to be backfilled or corrected (e.g. a wrong rate was used at trade time), the fix touches a row, not a calculation. That's actually the trade-off going *toward* this design — corrections are explicit edits, not silent re-reads.
- Historical price series are stored AUD-converted at the *price date*, not in their native currency. To switch base currency we'd need to keep native-currency prices too. The schema permits adding a column, so the door isn't closed.

## Alternatives considered

- **Store native, convert on read.** Cleaner from a "store the truth, derive the rest" perspective. Rejected because the cost (FX-rate management on every read, complex caching, edge cases around stale rates) outweighed the benefit for a single-currency-target product.
- **Store both native and AUD.** Effectively what we do for transactions (we keep local + AUD), but extending it to prices would double the price table size and complicate every read. Not worth it for a v1 that only reports AUD.
- **No base currency, dashboard shows mixed.** Considered absurd; users would mentally convert. Rejected on JTBD grounds (see [`docs/product/01-discovery.md`](../product/01-discovery.md)).

## Revisit if

- NZD support ships as v2C. At that point the schema will need a `base_currency` setting per profile and price storage will need native-currency support.
- The user base broadens to non-AU markets in any meaningful way. Currently neither expected nor wanted.
