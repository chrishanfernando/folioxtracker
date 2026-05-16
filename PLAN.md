# Risk Profiling Feature Plan

## Branch
`feature/risk-profiling`

---

## What we're building

A 5-question wizard that scores the user's risk tolerance, maps it to one of four tiers (Conservative / Balanced / Growth / Aggressive), and outputs a recommended ETF allocation with fund-level detail (ticker, MER, AUM, rationale). A single "Apply to Rebalance" button writes the recommended allocations to the existing `categoryTargets` table so the rebalance page picks them up immediately.

---

## Questionnaire (5 questions, max 13 points)

| # | Question | Options (points) |
|---|----------|-----------------|
| 1 | When do you expect to need most of this money? | < 2 yrs (0) · 2–5 yrs (1) · 5–10 yrs (2) · 10+ yrs (3) |
| 2 | How stable is your income? | Irregular (0) · Somewhat stable (1) · Stable employment (2) · Very stable / multiple sources (3) |
| 3 | If your portfolio dropped 20% in a month, you would… | Sell everything (0) · Sell some (1) · Hold and wait (2) · Buy more (3) |
| 4 | What is your primary investment goal? | Protect capital (0) · Modest growth (1) · Long-term wealth (2) · Maximum growth (3) |
| 5 | Do you have 3+ months of expenses saved outside this portfolio? | No (0) · Yes (1) |

**Scoring → Tier**

| Score | Tier |
|-------|------|
| 0–3 | Conservative |
| 4–6 | Balanced |
| 7–9 | Growth |
| 10–13 | Aggressive |

---

## ETF Recommendations per Tier

All ETFs are ASX-listed. MER and AUM figures are sourced from fund provider PDSs.

### Conservative
| Category | Ticker | Fund | Alloc | MER | AUM | Rationale |
|----------|--------|------|-------|-----|-----|-----------|
| AU Bonds | VAF | Vanguard AU Fixed Interest ETF | 40% | 0.10% pa | ~$2B | Core capital-preservation engine; tracks Bloomberg AusBond Composite |
| Intl Bonds | VIF | Vanguard Intl Fixed Interest ETF (Hdg) | 20% | 0.20% pa | ~$1B | Global bond diversification; currency-hedged to remove FX volatility |
| AU Equities | VAS | Vanguard AU Shares ETF | 25% | 0.07% pa | ~$15B | Largest AU ETF by AUM, highest liquidity; ASX 300 + franked dividends |
| Intl Equities | VGS | Vanguard MSCI Intl Shares ETF | 15% | 0.18% pa | ~$10B | Broad developed-market equity exposure ex-AU; second largest AU ETF |
| **Portfolio weighted MER** | | | | **~0.12% pa** | | |

### Balanced
| Category | Ticker | Fund | Alloc | MER | AUM | Rationale |
|----------|--------|------|-------|-----|-----|-----------|
| AU Equities | VAS | Vanguard AU Shares ETF | 35% | 0.07% pa | ~$15B | Highest-liquidity AU equity ETF; franked income benefit for AU tax residents |
| Intl Equities | VGS | Vanguard MSCI Intl Shares ETF | 35% | 0.18% pa | ~$10B | MSCI World ex-AU; 1,500+ holdings across 23 developed markets |
| AU Bonds | VAF | Vanguard AU Fixed Interest ETF | 20% | 0.10% pa | ~$2B | Dampens equity volatility; negatively correlated in most downturns |
| Intl Bonds | VIF | Vanguard Intl Fixed Interest ETF (Hdg) | 10% | 0.20% pa | ~$1B | Extra ballast; hedging removes currency noise from bond returns |
| **Portfolio weighted MER** | | | | **~0.13% pa** | | |

### Growth
| Category | Ticker | Fund | Alloc | MER | AUM | Rationale |
|----------|--------|------|-------|-----|-----|-----------|
| AU Equities | VAS | Vanguard AU Shares ETF | 40% | 0.07% pa | ~$15B | Ultra-low cost; strong franking credits meaningful at this allocation |
| Intl Equities | VGS | Vanguard MSCI Intl Shares ETF | 40% | 0.18% pa | ~$10B | Core global equity engine; avoids concentration in any single region |
| Emerging Markets | VGE | Vanguard FTSE Emerging Markets ETF | 10% | 0.48% pa | ~$1.5B | Higher growth potential; acceptable at 10% given long time horizon |
| Property | VAP | Vanguard AU Property Securities ETF | 10% | 0.23% pa | ~$2B | Real-asset diversification; historically low correlation to pure equities |
| **Portfolio weighted MER** | | | | **~0.17% pa** | | |

### Aggressive
| Category | Ticker | Fund | Alloc | MER | AUM | Rationale |
|----------|--------|------|-------|-----|-----|-----------|
| AU Equities | VAS | Vanguard AU Shares ETF | 30% | 0.07% pa | ~$15B | Franked dividends offset some of the higher overall MER in this portfolio |
| Intl Equities | VGS | Vanguard MSCI Intl Shares ETF | 35% | 0.18% pa | ~$10B | Broad developed-market anchor; limits single-sector concentration risk |
| US Tech | NDQ | BetaShares NASDAQ 100 ETF | 20% | 0.48% pa | ~$5B | Top-50 Nasdaq companies; highest 10-yr growth of any mainstream AU ETF |
| Emerging Markets | VGE | Vanguard FTSE Emerging Markets ETF | 15% | 0.48% pa | ~$1.5B | Long-horizon growth from India, China, Brazil, SE Asia |
| **Portfolio weighted MER** | | | | **~0.25% pa** | | |

---

## Files

### New
| File | Purpose |
|------|---------|
| `src/lib/risk-profiling.ts` | Static data: questions array, `scoreToTier()`, tier → ETF allocation map |
| `src/app/api/risk-profile/route.ts` | `GET` load saved profile; `POST` upsert result + optional apply-to-targets |
| `src/app/(authed)/risk-profile/page.tsx` | Quiz wizard UI + results page (single page, two view states) |

### Modified
| File | Change |
|------|--------|
| `src/db/schema.ts` | Add `riskProfiles` table |
| `src/components/layout/app-shell.tsx` | Add "Risk Profile" nav item (Brain icon, between Rebalance and Import) |

### Generated
| File | How |
|------|-----|
| `drizzle/0003_risk_profile.sql` | Auto-generated by `npm run db:generate` after schema change |

---

## DB Schema addition

```ts
// src/db/schema.ts
export const riskProfiles = sqliteTable('risk_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  riskScore: integer('risk_score').notNull(),
  riskTier: text('risk_tier').notNull(),   // 'conservative' | 'balanced' | 'growth' | 'aggressive'
  answers: text('answers').notNull(),       // JSON: number[] of selected option indices
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

---

## API

### `GET /api/risk-profile?profileId=N`
Returns `{ riskTier, riskScore, answers, updatedAt }` or `null` if none saved.

### `POST /api/risk-profile`
Body: `{ profileId, answers: number[], applyTargets?: boolean }`
- Scores answers → derives tier
- Upserts `risk_profiles` row
- If `applyTargets: true`: writes the tier's ETF categories as `categoryTargets` (overwriting previous targets for this profile)
- Returns `{ riskTier, riskScore, allocation }`

---

## Page UX (`/risk-profile`)

**State A — No saved profile (or "Retake" clicked):**
Quiz wizard:
- Progress bar: Step N of 5
- One question card at a time with 4 selectable option tiles
- Back / Next navigation; final step shows "See My Results"
- On submit: POST to API, transition to State B

**State B — Results:**
- Tier badge + one-paragraph description of what the tier means
- Score display: `X / 13`
- Allocation breakdown: horizontal stacked bar (Recharts) + legend
- ETF cards grid (2-col on desktop, 1-col mobile): each card shows:
  - Ticker in large type
  - Fund name + allocation %
  - MER badge + AUM chip
  - 1-line rationale
- Weighted portfolio MER callout
- **"Apply to Rebalance Targets"** button → POST with `applyTargets: true`, then toast + link to `/rebalance`
- "Retake quiz" text link

---

## Implementation Steps

1. Create and checkout branch `feature/risk-profiling`
2. Add `riskProfiles` table to `src/db/schema.ts`
3. Run `npm run db:generate` to emit `drizzle/0003_*.sql`
4. Write `src/lib/risk-profiling.ts` (questions + ETF data + scoring)
5. Write `src/app/api/risk-profile/route.ts`
6. Write `src/app/(authed)/risk-profile/page.tsx`
7. Add nav item to `src/components/layout/app-shell.tsx`
8. Run `npx tsc --noEmit` + `npm run lint` to verify
9. Commit and push

---

## Out of scope (v1)
- Fetching live ETF prices or MER from an API (static data is sufficient; MERs rarely change)
- Suggesting ETFs the user already holds (nice-to-have for v2)
- Multiple saved risk profiles per user (one per portfolio profile is enough)
