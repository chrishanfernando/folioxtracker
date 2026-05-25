# 06 — Metrics & Instrumentation Plan

> **Status:** Hypothetical for users beyond me. The current app has no analytics — by design (privacy thesis). This document is what I'd instrument *if* the strategy moved from Fork A toward Fork B/C and a paid tier were on the table. Privacy-respecting from the start, opt-in only.

## What I'd measure, and why

A glance product like this has a small number of meaningful events. Resist the urge to instrument everything.

### North star

> **Weekly active sessions per active install.**

I considered "DAU/MAU" and rejected it: this isn't a daily product. I check it 1–3 times a week, and that's the *correct* usage. Daily engagement would be a sign that something has gone wrong (notification spam, anxious checking, day-trader audience). A north star that punishes correct usage is the wrong star.

A weekly cadence captures the "did the user get value this week" signal without rewarding addictive UX patterns.

### Health metrics, by lifecycle stage

| Stage | Metric | Definition | Target (12 mo, hypothetical) |
| --- | --- | --- | --- |
| **Acquisition** | Repo → install conversion | Unique GitHub clones with completed `setup-pi.sh` or `npm run build` succeeding | 25% (loose proxy via opt-in heartbeat) |
| **Activation** | Time to first transaction | From first opening `/dashboard` to logging or importing a transaction | < 10 min for 50% of users |
| **Activation** | First-week retention | % of installs with ≥ 1 session in days 2–7 after first session | > 40% |
| **Engagement** | Weekly sessions per active install | Sessions in a 7-day window | 2–4 (correct usage) |
| **Engagement** | Feature adoption: imports | % of active installs that import at least once | > 60% |
| **Engagement** | Feature adoption: targets + rebalance | % of active installs that set ≥ 1 category target | > 30% |
| **Engagement** | Feature adoption: tax export (paid tier) | % of paid users producing ≥ 1 CGT report per FY | > 80% |
| **Retention** | D90 retention | % of installs active 90 days after first session | > 35% |
| **Retention** | Annual retention | % of installs active 12 months after first session | > 25% |
| **Monetisation** | Free → paid conversion | If paid tier ships: % of active free installs converting within 12 mo | 3–5% |
| **Operational** | Time-to-first-response on issues | Median, GitHub Issues + Discussions | < 24 h |
| **Operational** | Support load per active install | Hours/month spent on support divided by active installs | trending down |

The targets are honest guesses calibrated against OSS dev-tools benchmarks, not market validated. I'd recalibrate quarterly.

### Anti-metrics

Things I will *not* optimise for, and why:

- **Time-on-app / session length.** This is a glance product. Longer sessions usually mean someone got lost in the UI.
- **Notification engagement.** No notifications planned beyond the optional drift email. Push notifications are wrong for this audience.
- **DAU.** See north-star reasoning.
- **Page views.** Single-page-app SSR; pageviews don't mean anything.
- **Stars-per-week growth on GitHub.** Vanity metric; tracks but doesn't drive.

## What I'd instrument

### Events

A small, deliberate set. Each event is named in `verb_noun` form for SQL-ability later.

| Event | When | Properties |
| --- | --- | --- |
| `app_started` | First mount per session | profile_id (hashed), session_id |
| `transaction_logged` | After save, manual or import | source (`manual`/`cmc`/`stake`/...), action (`BUY`/`SELL`/`DIV`/...) |
| `import_completed` | After import job finishes | source, inserted_count, error_count |
| `target_set` | When a category target is created or updated | category (hashed), is_first_target_for_profile |
| `rebalance_recommendation_viewed` | When `/rebalance` is loaded with at least one needs-rebalance category | drift_max_pct |
| `dashboard_viewed` | On `/dashboard` mount | total_value_aud_bucket (rough log-scale buckets, not exact value) |
| `tax_report_generated` | Paid tier only | financial_year, parcel_count |
| `error_occurred` | Unhandled exception, server- or client-side | error_class, route |

What's deliberately missing: any field that could identify a person, a holding, or a real dollar amount. `total_value_aud_bucket` is bucketed (e.g. `<10k`, `10k–50k`, `50k–250k`, `250k–1m`, `>1m`) so it's useful for segmentation without leaking personal numbers.

### Telemetry transport

- **Opt-in only.** Default off. A toggle in `/settings` and a one-line note in the README about what's collected and why.
- **Self-hosted relay.** Events POST to a small endpoint I control, not a third-party analytics SaaS. Storing in the same SQLite/Postgres as the rest of the eventual managed tier infra.
- **No IPs, no user agents.** The relay strips them on receipt.
- **Aggregated only after 7 days.** Raw events purged; only daily aggregates retained.

This is more work than dropping in PostHog or Plausible, and it's the work that makes the privacy thesis honest. If users discover I'm shipping their behaviour to a US analytics vendor, the wedge dies.

### A/B testing

Not for v1. The user base is too small for statistical power and the iteration loop is fast enough that holistic judgement beats split-testing at this scale. Revisit at >1,000 active installs.

## How I'd report

A monthly metrics review, lightweight:

- Single dashboard, public-facing where possible. Demonstrates the same honesty I claim to value.
- Three slides: north-star trend, top three movers (good and bad), one decision the data is asking for.
- If the data isn't asking for a decision, the question is *what data is missing*, not *what slide do we make next*.

## How metrics feed back into the product

This is the bit most metrics plans skip and it's the most important. A metric that doesn't change a decision is decoration.

| Signal | Decision it triggers |
| --- | --- |
| Time-to-first-transaction > 15 min for >30% of installs | Setup UX is broken — invest in onboarding before features. |
| Import error_count exceeds inserted_count for any one source over a month | That importer has rotted (broker changed CSV format). Triage. |
| Rebalance recommendation views per active user trending down | Either the recommendation is bad, or category targets aren't being set. Investigate the upstream activation step before optimising the recommendation itself. |
| D90 retention < 25% | Strategy is broken; product isn't sticky enough. Pause feature work, do user interviews. |
| Free → paid conversion < 1% three months running | Either the paid tier is wrongly priced, the wrong feature is paywalled, or the audience is wrong for monetisation. Hypothesis test in that order. |
| Support hours per active install rising | Either documentation is failing, or a regression is propagating. Check release notes for what changed. |

## What this plan is *not*

- Not a dashboard mock. Tools have their own dashboard UX; the *taxonomy* is what matters.
- Not an attribution model. Single-channel marketing for now; UTM-tagging is enough.
- Not a forever-fixed taxonomy. Quarterly review of which events are still earning their keep.

## Honest caveat

I have not run this in production. The targets are calibrations against OSS / dev-tools benchmarks I've read or worked near. They will be wrong. The point of writing this plan now is not to get the targets right — it's to commit, in advance, to *which decisions each metric will inform*, so that when the data lands, I argue with it instead of around it.
