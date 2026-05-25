# 07 — Scope Cuts

> The discipline of writing down what we *didn't* build, and why. PMs are judged on the no's. This is the no list.

Each cut has a one-line *why* and an *un-cut trigger* — the signal that would make me revisit.

## Cut: Multi-currency reporting (USD/EUR/GBP base)

**Why.** AUD-native is the wedge. Going multi-currency dilutes the message and adds FX complexity to every read path. The non-AUD market is well-served by Snowball, Stockfolio, etc.
**Un-cut trigger.** ICP migrating from AU to dual-AU/NZ residency is common enough to demand NZD support. Tracked in roadmap.

## Cut: Real-time prices and intra-day P/L

**Why.** This is a glance product. Real-time prices invite the wrong audience (day traders) and require infrastructure (websockets, hot caches, paid market-data feeds) that the user economics can't support. Daily close is the right resolution.
**Un-cut trigger.** Never. This is a strategic position, not a tactical deferral.

## Cut: Brokerage credential aggregation (Plaid / Yodlee / direct)

**Why.** Privacy thesis. Storing brokerage credentials in our app — or trusting a third-party aggregator with them — collapses the moat. File-upload imports are the *feature*, not a bug.
**Un-cut trigger.** AU CDR (Consumer Data Right) extends to brokerage data with read-only OAuth-style consent. Then *and only then* aggregation is privacy-compatible.

## Cut: Native mobile apps (iOS/Android)

**Why.** Glance product. PWA + responsive web is enough. Native is a 6-month investment for a marginal UX gain on the most common use case (5 seconds, twice a week).
**Un-cut trigger.** ≥10k active installs and ≥30% of sessions are mobile-web with documented usability friction.

## Cut: Multi-user / shared portfolios / read-only invites

**Why.** Single-user-per-instance is the design centre and the privacy thesis. Multi-user means accounts, RBAC, sessions, audit logs, password resets — a different product.
**Un-cut trigger.** A clear use-case from couples managing one household portfolio appears in interviews repeatedly. Even then, "two profiles in one install" rather than "shared portfolio across two users" may be the right answer.

## Cut: Tax reporting (CGT) — *deferred, not abandoned*

**Why.** Right scope, wrong v0. Building tax features into the MVP would have triple the surface area and slowed every other feature. Deferred to v1 with a dedicated PRD ([05](./05-prd-tax-lot-tracking.md)).
**Un-cut trigger.** v0 is stable; tax is the wedge for the paid tier. Already on the roadmap.

## Cut: Accountant integrations (Xero, MYOB, BGL Simple Fund)

**Why.** Out of personal scope. The audience that needs this is SMSF trustees and small accounting firms, not retail self-directed investors. Different product.
**Un-cut trigger.** Tax tier launches and 20%+ of paid users mention accountant workflow in feedback.

## Cut: Crypto on-chain integration (wallet connect, DeFi positions, staking yields)

**Why.** Crypto-tax tools (Koinly, CryptoTaxCalculator) own this space and have invested years of engineering. Competing here directly is a losing fight.
**Un-cut trigger.** Strategic partnership with one of those tools (their depth + our AUD-and-equities integration) is a stronger play than building it ourselves.

## Cut: Dividend reinvestment plan (DRP) automation

**Why.** Manual logging is fine; DRP automation is one more importer, not a category. Build the importer when one user asks twice.
**Un-cut trigger.** Three users ask in interviews/issues.

## Cut: Asset-level price alerts / threshold notifications

**Why.** This is a portfolio-level product, not a watchlist. Price alerts are what the broker app is for.
**Un-cut trigger.** Never expected.

## Cut: Performance benchmarking against indices (VAS, IOO, SPY)

**Why.** Looks easy, opens a deep hole — TWR vs MWR vs IRR is a real disagreement, and presenting *one* number invites the user to argue with the wrong one. Sharesight does this and it's the most argued-about feature in their forums.
**Un-cut trigger.** A clear v2 PRD that picks a methodology, defends it, and shows the trade-off explicitly. Until then, the dashboard is one number (your portfolio) and that's it.

## Cut: Public hosting / centralised SaaS (initial)

**Why.** Privacy thesis. The first version is self-host or nothing.
**Un-cut trigger.** ≥50 waitlist signups for a managed-self-host tier where I run the VPS for them on their behalf. Note: this is *managed self-host*, not multi-tenant SaaS — the privacy thesis still holds because each user has their own instance and database.

## Cut: Bond / fixed-income / managed-fund tracking

**Why.** Different price-source story (no Yahoo coverage), different cost-basis treatment (managed funds use average-cost, not FIFO, for CGT), different audience.
**Un-cut trigger.** Tax tier ships and a meaningful fraction of users are SMSF trustees with bond ladders.

## Cut: AI / LLM-driven anything

**Why.** I can't think of a job-to-be-done in this product where an LLM beats deterministic computation. Categorisation suggestions for new tickers might be the closest, but a static map plus a search box already covers it. Adding "AI" to a financial product is mostly theatre at this scale.
**Un-cut trigger.** A specific feature where an LLM measurably outperforms the deterministic alternative on a job a user actually has. Anomaly detection on transaction imports is the most plausible candidate.

## Cut: Onboarding tour / interactive walkthrough

**Why.** The product audience is technical. They prefer a working README over an in-app coach mark.
**Un-cut trigger.** Activation rate (time-to-first-transaction) is below target *and* user feedback says onboarding, not the README, is the friction.

## A note on saying no

The honest reason any of these is cut is that I have a 5-hour-a-week budget. With infinite hours I would build several of them. A scope-cuts list is mostly a list of things you'd love to build but won't, ranked. Calling that out makes the no's defensible — "we'd love to but it crowds out the wedge" is a better answer than "no, never."
