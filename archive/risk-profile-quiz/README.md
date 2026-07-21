# Archived: personalised risk-profile questionnaire

**Archived 2026-07-21.** This feature was retired to keep FolioX Tracker clearly on the
"general information / educational tool" side of the line and avoid resembling *personal*
financial product advice under the Corporations Act (Cth).

## What it did

A 5-question quiz asked about the user's personal circumstances — time horizon, income
stability, loss tolerance, investment goal, emergency-fund coverage — scored them, mapped
the score to a risk tier (conservative / balanced / growth / aggressive), and then presented
**specific named ETFs with specific weights as "your recommended allocation."** The
questionnaire-about-personal-circumstances → specific-product-recommendation combination is
the shape the regulator treats as personal advice.

## What replaced it

The same four model portfolios are now presented as an **educational library of labelled
example portfolios** (`/portfolios`, `src/lib/model-portfolios.ts`) — browsable by anyone,
not derived from any personal questionnaire, and never framed as "your" recommendation. The
user can optionally copy an example's category split into their own rebalance targets as an
explicit, self-directed choice.

## Files here (verbatim copies of the retired code)

| Archived path | Original location |
|---|---|
| `lib/risk-profiling.ts` | `src/lib/risk-profiling.ts` |
| `page/page.tsx` | `src/app/(authed)/risk-profile/page.tsx` |
| `api/route.ts` | `src/app/api/risk-profile/route.ts` |
| `component/onboarding-gate.tsx` | `src/components/onboarding-gate.tsx` |

The `risk_profiles` database table (`src/db/schema.ts`) was **left in place** — no migration
was run to drop it — so archived answers/scores survive and the feature can be restored
without a schema change.

## To restore

1. Copy the four files back to their original locations above.
2. Re-add `import { OnboardingGate }` and wrap children in `src/app/(authed)/layout.tsx`.
3. Restore the `/risk-profile` nav item in `src/components/layout/app-shell.tsx` and point
   the dashboard "Set targets first" link back to `/risk-profile`.
4. Re-add `RISK_PROFILE_COMPLETED` usage in `src/lib/analytics.ts` (the constant may still
   be present) and the metrics label in `src/lib/metrics.ts`.
5. Restore `tierEtfsForCategory` in `src/lib/rebalance.ts` (see git history for commit
   that removed it).

Before restoring, get the advice-vs-tool question reviewed — that's why it was retired.
