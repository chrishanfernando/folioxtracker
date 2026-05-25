# ADR 0006 — Yahoo Finance as the sole price source

| | |
| --- | --- |
| Status | Accepted |
| Date | 2026-03-04 |
| Deciders | (me) |

## Context

The app needs daily closing prices for every asset across equities, ETFs, crypto, and gold futures. Common options:

- **Yahoo Finance** (via `yahoo-finance2`): unofficial scraping wrapper around Yahoo's public endpoints. Free, no key, broad coverage. Can break when Yahoo's HTML/JSON changes.
- **Paid market-data APIs** (Refinitiv, Bloomberg, Polygon, IEX Cloud, EOD Historical Data, Twelve Data): formal contracts, SLAs, and recurring cost (~US$10–100+/mo for the relevant tiers).
- **Brokerage APIs** for the user's actual prices: per-broker integration cost, brittle, and many AU brokers don't expose programmatic feeds.
- **CoinGecko / CoinMarketCap** for crypto specifically; exchange APIs (Binance, Coinbase) for crypto.

## Decision

**Use Yahoo Finance via `yahoo-finance2` as the sole price source for v1**, including for crypto (`BTC-AUD`, `ETH-AUD`) and gold (`GC=F` futures). FX is also from Yahoo (`AUDUSD=X`).

## Consequences

**Accepted.**

- One integration, one failure mode, one rate-limit story. The codebase is much simpler.
- Free. Important for an OSS / self-hosted product where users shouldn't need to bring their own API keys to see a price.
- Coverage is broad enough for a retail AU portfolio: ASX (`.AX` suffix), US listings, the major crypto pairs, gold futures.
- Crypto prices via Yahoo are sourced from CoinMarketCap and are good enough for a daily close on common pairs.

**Trade-offs accepted.**

- **Reliability risk.** Yahoo is not a contract, it's a scrape. The `yahoo-finance2` library has historically absorbed Yahoo's breakages for users, but that buffer is on someone else's free time.
- **Symbol churn.** Tickers occasionally change, especially for crypto. The current code handles a fallback FX rate (0.65) when Yahoo errors, which is the only mitigation today.
- **No real-time prices.** Yahoo gives you ~15-minute-delayed quotes at best, which we don't use anyway (see [scope cuts](../product/07-scope-cuts.md)).
- **Some symbols don't resolve** — niche AU LICs, some crypto pairs. The user can flag the asset inactive or contribute a different `yahoo_symbol`.

## Alternatives considered

- **Paid feed (e.g. EOD Historical Data, ~US$20/mo).** Rejected for v1 — adds a recurring cost to a free product and an API key to the setup story. Reconsider if Yahoo reliability becomes a chronic issue, or if the paid tier ships and EOD Historical Data is bundled.
- **Hybrid (Yahoo for equities, exchange APIs for crypto).** Cleaner separation but more integration surface. Rejected on simplicity.
- **User-supplied prices for unsupported assets.** A manual price-entry path. Already exists implicitly (the `prices` table accepts any rows); not first-classed in UI. Could be elevated as a fallback if Yahoo coverage is the limiting factor for some users.

## Revisit if

- Yahoo Finance breaks for more than a week without a `yahoo-finance2` fix landing.
- A user category emerges that Yahoo can't cover (institutional bond tracking, exotic derivatives, illiquid LICs).
- The paid tier launches and a paid data feed is bundled into the price.
