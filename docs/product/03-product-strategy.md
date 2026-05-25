# 03 — Product Strategy

> **Status:** Strategic thought-experiment, not a launched plan. The exercise is "if I treated this as a product, what's the bet?"

## Framing

A product strategy answers four questions: *who is it for, what unique value does it provide, why us, and what do we say no to.* The discovery and competitive docs supply the inputs. This document chooses among forks.

## The forks

There are three legitimate paths for this codebase. They are not mutually exclusive, but each frames the design centre differently.

### Fork A — Keep it personal

Continue using it for myself. Open-source nothing. No GTM, no support burden.

- **Pros.** Zero ongoing cost. Full freedom to break things. Best ROI of time vs. life utility.
- **Cons.** Doesn't compound. The skill demonstration is the project itself, not the audience.
- **Who pays.** Nobody. I save A$300–540/yr in Sharesight subscriptions.

### Fork B — Open source

Polish the README and self-host story, license it MIT, encourage forks. Maybe accept PRs for new importers.

- **Pros.** Compounds — the OSS surface itself becomes a portfolio piece. Aligns with the "self-host beats SaaS" thesis. Low commercial risk.
- **Cons.** Real maintainer overhead (issue triage, PR review, security disclosures). The audience is small (privacy-conscious AU multi-platform investors who can `git clone` and `npm install`).
- **Who pays.** Nobody directly. Indirect: hiring signal, possibly contributors who unlock features I'd otherwise build solo.

### Fork C — Commercial (managed self-host or SaaS)

Stand up a paid tier. Either *managed self-host* (one-click deploys to user's own VPS for a small fee) or a *SaaS* with the privacy promise softened (encrypted at rest, customer-managed keys, hosted in AU).

- **Pros.** A real revenue path. Tax features (Sharesight charges A$300–540/yr) are the obvious paywall.
- **Cons.** The privacy thesis I built the product on weakens as soon as I host data. Compliance and support load are real (AFSL? probably not, since I'm not advising; but tax-export liability is a thing). Five hours a week of side-project time is not enough.
- **Who pays.** ICP from [discovery](./01-discovery.md) — AU multi-platform investors at tax time. Pricing range from competitive analysis: A$10–30/mo without tax features, A$25–45/mo with.

## The bet

**Fork B (open source), with a deliberate option on C (commercial) held open for the tax features.**

Reasoning, in plain language:

- **A doesn't compound.** It's the right answer for someone who isn't trying to evidence PM judgement publicly. I am, so I rule it out.
- **C is the highest-payoff path but it requires more than 5 hr/wk and it directly contradicts the privacy thesis.** Going SaaS-first turns me into a worse Sharesight. Going managed-self-host-first is a real wedge but the operational lift is heavy and the addressable market is narrow enough that the per-user economics need to be proven before I commit.
- **B is the path that compounds without the operational tax of C.** It puts the codebase in the hands of the people most likely to give honest feedback (other engineers in the ICP). It's the cheapest way to learn whether the privacy + AUD-native + multi-asset positioning actually resonates with anyone besides me.

The option on C stays open: tax features get prototyped under a non-OSS license (or a distinct package), so if user signal is strong enough I can offer them as a paid managed tier without re-architecting.

## What that means concretely

| Decision | Concrete consequence |
| --- | --- |
| Open-source the core | Pick MIT or AGPL-3.0; AGPL deters SaaS rip-offs but scares some users. Lean MIT. |
| Treat tax features differently | Either separate repo with non-OSS license, or `pro/` directory in this repo with a paid-tier license. |
| Build for fork-ability | The `ticker-map.ts` is empty by design; the OpenSpec workflow is documented; the README walks through self-host. Already done. |
| Land the ICP | Write for /r/AusFinance and /r/CryptoCurrencyAU. Not for HackerNews or ProductHunt. |
| Don't add SaaS infra prematurely | No multi-tenancy refactor, no central price service. Resist the temptation to build C while in B. |

## What I'd say no to

- **Adding accounts, SSO, multi-tenancy.** The single-user-per-instance design is the privacy thesis. Breaking it loses the wedge.
- **A mobile app.** PWA / responsive web is enough. Native app costs months for a glance product.
- **Brokerage credential aggregation.** Same privacy thesis. CDR/open-banking *read-only* could be reconsidered when it matures.
- **Real-time prices, intra-day P/L.** Daily close is the whole product. Real-time invites the wrong user (day traders) and the wrong infra (websockets, hot caches).
- **Ad-supported free tier.** Wrong audience. Privacy-conscious users will route around ads.
- **Accountant integrations.** Out of personal scope. A CGT export CSV is enough.

## Success criteria for the strategy

If I'm executing on Fork B + option-on-C, the leading indicators I'd watch over 12 months:

| Signal | Threshold for "this is working" | Threshold for "rethink" |
| --- | --- | --- |
| GitHub stars | 200+ in 6 mo | <30 in 6 mo |
| Self-hosted installs (anonymised telemetry, opt-in) | 100+ active in 6 mo | <20 |
| Inbound user-research interest | 10+ unsolicited interview offers | 0 |
| PR contributions | 5+ external PRs merged in 6 mo | 0 |
| Tax-feature waitlist signups (when announced) | 50+ in 4 weeks at A$15/mo target price | <10 |

Those numbers are honest guesses, not market-validated. I'd recalibrate them after the first month.

## What kills the bet

- **Sharesight ships a self-host or local-data product.** The privacy wedge collapses; pivot to differentiation on AUD-multi-asset depth or accept the strategy is dead.
- **CDR mature open-banking APIs become available for AU brokers.** File-import-as-feature becomes file-import-as-friction. The product needs API integrations to stay relevant.
- **The ICP turns out not to exist.** If <20 active self-hosters after 6 months of OSS, the privacy-conscious-AU-multi-platform segment was probably me and three Reddit users.

## Why this isn't a pitch deck

A pitch deck would size the TAM, draw a hockey stick, and ask for capital. This is a side-project bet by a senior engineer who's deciding how to spend ~5 hours a week on a project he uses himself. The discipline of writing it is the same — ICP, value, why-now, what-we-say-no-to — but the artefact format follows the situation, not the other way around.
