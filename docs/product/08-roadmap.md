# 08 — Roadmap

> **Status:** Hypothetical roadmap sized to a 5-hr/wk side-project velocity. Dates are *intent*, not commitments. Everything below assumes [Fork B (open source) with an option on Fork C (paid tax tier)](./03-product-strategy.md).

## How this roadmap is sized

A real PM roadmap commits stakeholders to dates. This one commits *me* to a sequence and a velocity. I deliberately don't put quarter labels on it because the velocity is too slow to be quarterly-meaningful, and putting fake quarters on side-project dates is exactly the kind of theatre I'm trying to avoid.

The unit is **weeks of effort at 5 hours/week**, with a 1.3× contingency multiplier already baked in.

## Now (in flight)

| Item | Effort | Why now |
| --- | --- | --- |
| OpenSpec adoption + spec backfill | done | Already in `openspec/specs/`; the foundation for everything else. |
| CI + Dependabot + CodeQL | done | Quality floor before any community lands. |
| Lint baseline cleanup | 1 wk | Promote lint to a blocking CI step. Closes off "vibe-coded" baseline. |
| Light onboarding polish | 1 wk | The README walkthrough exists; the first-run UX still has rough edges (no demo data option, no helpful empty state on `/dashboard`). |
| Telemetry opt-in scaffolding | 2 wk | Per [06 — metrics](./06-metrics-plan.md). Shipped opt-out by default; toggle in settings. |

## Next (v1 — "the wedge ships")

| Item | Effort | Notes |
| --- | --- | --- |
| Tax-lot tracking + CGT export | 12 wk | Per [05 — PRD](./05-prd-tax-lot-tracking.md). The single biggest item. |
| `/tax` page UX | (in PRD) | Sized inside the PRD, not duplicated here. |
| Documentation polish for OSS launch | 2 wk | Setup video, screenshots, contribution guide, issue templates. |
| First public launch (Reddit + blog) | 1 wk | Per [04 — GTM](./04-gtm-strategy.md), week 0–2 launch sequence. |
| Issue triage capacity | 2 hr/wk ongoing | Operational, not a deliverable. |
| **v1 total** | **~15 wk** | ~4 months at 5 hr/wk. |

This is the realistic horizon. Anything beyond v1 is conditional on what user signal looks like after launch.

## Later (v2 — conditional)

Each of these is a fork. I'd commit to one, not all. Choosing depends on what v1's user research surfaces.

### v2 candidate A: Managed self-host paid tier

Per [03 — strategy](./03-product-strategy.md) Fork C option. Requires waitlist signal first (50+ signups at A$15/mo target).

| Item | Effort | Notes |
| --- | --- | --- |
| One-click Pi/VPS deploy script | 3 wk | Improves OSS path *and* underpins managed offering. |
| Managed-deploy infra (per-customer instance) | 6 wk | Terraform / Ansible / Nomad — pick one. Single-tenant per customer. |
| Billing (Stripe) + customer dashboard | 3 wk | Stripe Checkout, no subscription complexity beyond that. |
| Compliance / TPB / accountant review | 2 wk | Confirm tax-export liability surface. May require legal advice. |
| **A total** | **~14 wk** | Adds an ongoing 5+ hr/wk operational tax. |

### v2 candidate B: AU broker depth

Stay free, deepen the moat with importers no one else has. CommSec, NABTrade, Westpac, SelfWealth, eToro AU.

| Item | Effort | Notes |
| --- | --- | --- |
| Per-broker importer (avg.) | 2 wk each | 4 brokers = 8 wk. |
| Broker email auto-import generalised | 3 wk | Today only CMC has it; refactor for any source. |
| **B total** | **~11 wk** | Strengthens free tier; doesn't directly drive revenue. |

### v2 candidate C: NZ extension

Smallest viable adjacent market. NZD base, NZ tax (no CGT for most retail; FIF for >NZ$50k offshore — different regime).

| Item | Effort | Notes |
| --- | --- | --- |
| NZD as base currency option | 2 wk | Generalise the AUD assumption. |
| NZX importer | 2 wk | Sharesies, Hatch. |
| FIF reporting (NZ tax) | 4 wk | Different regime; separate PRD warranted. |
| **C total** | **~8 wk** | Smaller market than AU; lower priority unless I get NZ-resident interview signal. |

## Watch list (not committed; tracked because they could change the bet)

- **Sharesight ships local-data / self-host.** Privacy wedge collapses. Reposition on AUD-multi-asset depth.
- **AU CDR extends to brokerage data.** File imports become friction; build OAuth-based connectors.
- **Open-source competitor lands AU-shaped product.** (Ghostfolio is closest globally; an AU fork is plausible.) Differentiation pressure increases; consider partnership over duplication.
- **ATO digital-services platform changes.** May open API-based lodgement; could be a revenue path or could obsolete the CGT export.
- **Crypto-tax-product consolidation.** If Koinly buys CryptoTaxCalculator AU or similar, partnership opportunities open.

## Things that are *not* on the roadmap (and why)

See [07 — scope cuts](./07-scope-cuts.md). Every "later" candidate is on this roadmap; everything *not* on this roadmap is in scope cuts with a recorded reason.

## Cadence and review

- **Weekly.** Tick items in the in-flight list. No formal review.
- **Monthly.** 30-min review against [06 — metrics](./06-metrics-plan.md). Adjust priority of "next" items based on what signal landed.
- **Quarterly.** Re-evaluate v2 candidate against user research. Pick *one* if any.

## Why this roadmap looks "small"

A real-product roadmap from a full-time team would have 10× the items per quarter. This is a single engineer at 5 hr/wk. Putting more on the page would be inflating scope to look serious. The discipline is the same as any roadmap — sequencing, conditionality, what triggers a re-plan — applied to a realistic capacity.

If I were managing a team of 5 against this strategy I'd resequence: spin up tax-lot tracking and broker-depth in parallel, run user research alongside both, and target v1 at 8 weeks with v2A starting at week 6. The shape of the work doesn't change; the cadence does.
