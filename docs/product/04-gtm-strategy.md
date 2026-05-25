# 04 — Go-to-Market Strategy

> **Status:** Hypothetical — written as the GTM I would execute if I committed to Fork B (open source) per [03 — strategy](./03-product-strategy.md), with an option on the paid tax tier later. **No launch has happened. No spend has been committed.** This document exists because GTM thinking is a stated gap I'm working to evidence.

## Objective for the first 6 months

Acquire 100 active self-hosted installations and 50 names on a tax-feature waitlist. Validate the privacy + AUD-native + multi-asset positioning. Generate the user research that should have come *before* the product (an inversion I'm being honest about).

This is not a revenue objective. Revenue requires the paid tax tier, which requires the waitlist signal first.

## ICP refinement

From [01 — discovery](./01-discovery.md), narrowed:

- **Persona:** Privacy-conscious Australian retail investor with a multi-platform portfolio (≥3 accounts across at least two of: ASX broker, US-equities broker, crypto exchange).
- **Demographics:** 28–50, technical literacy "can deploy a Docker container" or "has a Raspberry Pi running something". Skews male given Australian retail-investor demographics, deliberately not exclusively so.
- **Income:** Mid-six-figure portfolio is the threshold where rebalancing matters and tax friction is real. Below that, spreadsheets are enough.
- **Where they hang out:** /r/AusFinance, /r/AusFinanceLeftWing, /r/CryptoCurrencyAU, /r/selfhosted (cross-cut), Aussie HackerNews-equivalent (Whirlpool tech forums), AusFinance Discord, Bogleheads-style Facebook groups.
- **Primary triggers:** Tax season (June/July). Major market drawdown (rebalancing trigger). Switching brokers or adding crypto exchange (multi-platform pain spike).

What this excludes deliberately: non-AU investors, single-broker users, day traders, casual app-store browsers. Those segments are larger but worse-fit, and competing for them puts me against polished SaaS incumbents.

## Positioning

> **For** Australian investors with money across brokers and crypto exchanges
> **who** don't want to hand a SaaS their brokerage credentials,
> **this is** an AUD-native portfolio tracker that runs on your own machine,
> **unlike** Sharesight or Snowball,
> **which** are cloud-only, USD-default, or both.

Tested via: tagline reactions in 5 user interviews; click-through rate on landing-page A/B between this and a generic "track your portfolio" framing.

## Channels

I rate each channel by *fit-with-ICP × cost × my ability to execute solo at 5 hr/wk*. Bias toward channels where the ICP self-selects.

### Tier 1 — go now

**Reddit (/r/AusFinance, /r/CryptoCurrencyAU, /r/selfhosted).** ICP density is high. Posting style is: *show, don't sell.* A "I built this for myself, here's the GitHub, here's what it does, here's what it doesn't, AMA" thread converts in this audience if it's honest. One thread per subreddit, spaced over weeks.

**Long-form blog post / write-up.** A detailed piece — *"Why I stopped paying for Sharesight and built my own AUD-native portfolio tracker"* — published on a personal blog and cross-posted. Does double duty as SEO anchor for "AUD portfolio tracker" / "Sharesight alternative" / "self-host portfolio tracker" search terms. One piece, refined.

**GitHub itself.** A great README, a working demo screenshot, a 30-second screencast. The repo is a channel. Optimise the first-30-seconds-of-landing experience.

### Tier 2 — go after Tier 1 lands

**Whirlpool finance and tech forums.** Higher-quality-per-post than Reddit, smaller audience. Worth one announcement once the product is past obvious bugs.

**AU finance podcasts.** *Equity Mates*, *My Millennial Money*, *Aussie FIRE*. Long lead time, low conversion, but the right audience. Not worth pitching cold without traction; revisit at 100 installs.

**Newsletter sponsorships.** *Finimize AU*, *Aus Investors* newsletters. Paid. Not worth it without revenue, but on the radar for the paid-tier launch.

### Tier 3 — explicitly not now

- **Paid Google / Meta ads.** The keywords are competitive (Sharesight, Stake brand bids), CAC will be high, no LTV to amortise against.
- **Influencer partnerships.** Wrong audience for an OSS launch.
- **Press / TechCrunch / SmartCompany.** No story until there's traction.
- **App store presence.** No mobile app; this would be a lie.

## Launch sequence

| Week | Milestone | Output |
| --- | --- | --- |
| –4 to –1 | Pre-launch polish | README walkthrough, screencast, demo data seed, first-run UX clean, two real importers known to work |
| 0 | Soft launch | Post on /r/selfhosted ("[I built this] AUD-native portfolio tracker, multi-broker, runs on a Pi"). Goal: 5 critical readers, fix top 3 issues they raise. |
| 1 | Iterate | Address feedback. Improve setup script if installs are failing. |
| 2 | Wider launch | /r/AusFinance + /r/CryptoCurrencyAU posts. Personal blog post live. Set up GitHub Discussions for support. |
| 3–4 | Engage | Reply to every issue, every PR, every comment. Cadence matters here. |
| 5–8 | First content cycle | Write 2–3 blog posts ("how I think about rebalancing", "why AUD-native matters for AU investors", "tax-lot tracking design"). SEO compounding. |
| 9–12 | Tax-feature waitlist | Add a `/waitlist` route with one-line description and email field. Promote across owned channels only. |
| 13–24 | Maintain + measure | Monthly post-mortem against the success criteria in [03 — strategy](./03-product-strategy.md). |

## Pricing (when paid tier ships)

For the *eventual* tax-tier, my pricing thesis:

- **A$15/mo or A$120/yr** — undercuts Sharesight's tax tier (~A$25–45/mo) by enough to be a real switching incentive, while being high enough that waitlist signups self-select for actual willingness to pay.
- **One-time A$200 self-host license** — for the segment that hates subscriptions. Caps revenue but matches the privacy-thesis crowd's preferences.
- **Free OSS tier remains free forever, including the rebalance and dashboard features.** Tax export is the wedge, not the only feature.

I'd validate by listing the price on the waitlist page and tracking signup rates against an unpriced control. Surveys for price-sensitivity are weaker signal; willingness-to-give-an-email-with-a-price-shown is better.

## Metrics

Leading indicators tracked weekly (see [06 — metrics plan](./06-metrics-plan.md) for the full taxonomy):

- GitHub stars (vanity but easy to read)
- README → install conversion (proxy via screencast view % completion if I can get it)
- Issue volume and time-to-first-response (operational health)
- Waitlist signups per week
- Reddit/blog post outbound clicks → repo

Lagging indicators tracked monthly:

- Active installations (opt-in telemetry — privacy-respecting, single anonymous heartbeat)
- Conversion of waitlist → "yes I'd pay $15/mo" survey
- External contributors (PR authors who aren't me)

## Risks and mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Sharesight ships self-host. Privacy wedge dies. | Low-medium | Pivot to "AUD-multi-asset depth" as the primary differentiator. The depth is real and harder to copy than self-host. |
| Reddit launch flops; no organic interest. | Medium | The strategy *is* the test. If two well-prepared posts in two well-chosen subreddits don't convert, the ICP probably isn't there. Go back to Fork A. |
| Support load consumes the 5 hr/wk before tax tier ships. | Medium-high | GitHub Discussions, not email. FAQ-driven responses. Time-cap support at 2 hr/wk. Aggressive issue templates. |
| Someone forks and SaaS-ifies it. | Low under MIT, mitigated under AGPL | Decide license deliberately ([decision pending](../decisions/)). |
| Tax-feature scope explodes. | High | Treat as a separate PRD (see [05](./05-prd-tax-lot-tracking.md)) with hard scope cuts. |

## What I'd kill the GTM for

- 6 months in, fewer than 20 active installs and zero unsolicited interview requests. Reposition or wind back to Fork A.
- A direct competitor with stronger distribution lands the same wedge first. Acknowledge and step back rather than fight a brand war I can't win.
- Tax compliance liability turns out to require AFSL / TPB registration for the paid tier. Reroute revenue thesis or shut the paid path entirely.

## Why this is GTM and not marketing

Marketing is "how do I get this in front of people"; GTM is "what's the smallest set of decisions about *who, what they pay for, when they hear about it, and how I support them* that makes the strategy executable." The channels section is the marketing layer; everything above it is GTM.
