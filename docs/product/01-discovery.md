# 01 — Discovery

> **Status:** Live document. Last updated 2026-05-05.
> **Honesty caveat:** primary research is N=1 (me). I document the validated bits, the unvalidated bits, and how I'd extend to N=20 in a week.

## The problem I started with

> *"I have money in CommSec, CMC Markets, Stake, Swyftx, Independent Reserve, and Perth Mint. To know what my portfolio is actually doing, I have to log into six sites, copy numbers into a spreadsheet, and convert USD trades to AUD by hand. By the time I've done that I've lost the willingness to make the rebalancing call I sat down to make."*

That's the problem statement in plain language. It came from the friction I personally hit, not from a survey.

## Who has this problem

The shape of the user, sized loosely:

- **Australian retail investor.** AUD is base currency; tax is reported in AUD; CGT rules are AU-specific.
- **Multi-platform.** At least one ASX broker, at least one US-equities broker, and at least one crypto exchange. Three accounts is the threshold where spreadsheets stop scaling.
- **Self-directed.** Not using a financial advisor; makes own allocation calls. Cares enough to rebalance, not enough to do it daily.
- **Tax-aware.** Lodges their own return or works closely with an accountant; CGT is a real concern.
- **Privacy-leaning.** Uncomfortable handing brokerage credentials to a SaaS. Self-host or read-only file imports preferred.

This is a sub-segment of a real, sized population — the ATO reports millions of Australian individual share investors, and ASIC tracks crypto adoption at ~25% of adults. I haven't sized the multi-platform-AND-tax-aware-AND-privacy-leaning intersection, which is where I'd start a real round of research.

## Jobs to be done

Framing the JTBD literally rather than as a feature list:

1. **"When I have 5 minutes between meetings and want to know if my portfolio is healthy, help me see one number with context, so I don't have to think hard."** → Dashboard glance.
2. **"When markets move sharply, help me decide whether to act, so I'm responding to drift rather than to news."** → Rebalance recommendations against targets.
3. **"When I have a new pay cheque to invest, tell me where it should go to bring me toward target without selling, so I'm not optimising in my head."** → Buy-only rebalance plan.
4. **"When tax time comes, give me a CGT-ready report in AUD, so my accountant doesn't bill me 4 hours of normalisation work."** → Tax export. *(Not built yet — see [05-prd-tax-lot-tracking.md](./05-prd-tax-lot-tracking.md).)*
5. **"When I import statements from a broker, don't make me hand-clean the data, so I keep using the tool."** → Source-specific importers.

The dashboard, rebalance, and importers are the three jobs I built first. They're the ones I do weekly. Tax is the one I do annually but the one with highest consequence if it's wrong — explicit risk-vs-frequency trade-off.

## What I validated by building it for myself

These are claims I now hold with high confidence because I lived with the product:

- **Daily prices are enough.** I never needed real-time. I check at most twice a day.
- **AUD-native is the killer feature.** The thing that made me stop using my spreadsheet was that the spreadsheet showed mixed currencies and I had to mental-math. AUD-everywhere removed that.
- **Category targets > per-asset targets.** I wanted to think in "20% crypto, 30% AU equities, 30% US equities, 10% emerging, 10% gold", not in "5% VAS, 8% IVV, 4% IOO". Per-asset targets would force allocation decisions I don't want to make in advance.
- **Buy-only rebalance > sell-and-rebalance.** I never want to sell to rebalance — CGT consequences. I always have new cash to deploy. The product should bias toward that.
- **Self-host beats SaaS for me.** I would not give a third-party app my brokerage credentials. File-upload imports + my own DB is a feature, not a constraint.
- **Multi-profile matters.** Personal account vs SMSF vs partner's account is three different portfolios with different targets. One-portfolio-per-app is wrong.

## What I haven't validated

These are the unvalidated assumptions that would matter if I treated this as a product, not a side project:

| Assumption | What I believe | How I'd test |
| --- | --- | --- |
| Self-host preference is widespread, not just me | Maybe 20–30% of the AU privacy-conscious segment | Reddit poll on /r/AusFinance + /r/CryptoCurrencyAU; user interviews |
| AUD-native is the differentiator vs Sharesight | High | 5 user interviews; ask "what made you stop using your last tool" |
| People will pay for tax export | Medium-high (Sharesight charges $25–$45/mo and it's mostly for tax) | Pricing-sensitivity survey + landing page test |
| The complexity of multi-platform import is the moat | Medium | Count of supported platforms vs competitors; would users switch for one more importer |
| "Buy-only" rebalance reframing resonates | High for tax-aware investors | Show the recommendation UX vs sell-and-rebalance UX in 5 user tests |

## Pain points I'd dig deeper on

If I had a week and a research budget I'd run interviews around these specific moments:

1. **The "I logged into six sites and gave up" moment.** Frequency, severity, what they did instead.
2. **The "my accountant billed me 4 hours for portfolio normalisation" moment.** Real pain, willingness to pay.
3. **The "I bought when I should have rebalanced" moment.** How often does someone make a worse allocation decision because they didn't know their drift?
4. **The "I don't trust this SaaS with my brokerage password" moment.** Size of the privacy-conscious segment.

## How I'd extend research to N=20 in a week

Honest plan, not theatre:

- **Day 1.** Post a recruiting thread on /r/AusFinance and /r/AusFinance's Discord ("Building an AUD-native multi-platform portfolio tracker, looking for 20 people for a 30-min call, no pitch"). Set up Calendly. Draft 8-question semi-structured interview guide.
- **Days 2–6.** Run 4–5 calls per day. Same script, recorded with permission, transcribed.
- **Day 7.** Synthesis: affinity-map pain points, count assumption hits/misses, write up findings as a delta on this document.
- **Spend.** ~$500 in $25 gift-card incentives, free tooling for everything else.

Outputs would be: a validated/invalidated table replacing the one above, a quotes file, and a revised JTBD with confidence levels.

## What this discovery doc is *not*

- Not a market-sizing exercise. The TAM/SAM/SOM analysis lives in [03 — Product strategy](./03-product-strategy.md) where it belongs.
- Not a feature list. The mapping from JTBD to features lives in the OpenSpec capability specs (`openspec/specs/`).
- Not a competitive teardown. That's [02 — Competitive analysis](./02-competitive-analysis.md).
- Not validated truth. It's the best honest take from N=1 + secondary signal, with explicit unknowns called out.
