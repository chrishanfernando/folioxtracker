export type RiskTier = 'conservative' | 'balanced' | 'growth' | 'aggressive';

export interface Question {
  id: number;
  text: string;
  options: { label: string; description: string; points: number }[];
}

export interface EtfRecommendation {
  ticker: string;
  name: string;
  category: string;
  allocationPct: number;
  mer: number;       // annual %, e.g. 0.07
  aum: string;       // display string e.g. "~$15B"
  rationale: string;
}

export interface TierProfile {
  tier: RiskTier;
  label: string;
  growthPct: number;
  defensivePct: number;
  description: string;
  sources: string[];
  etfs: EtfRecommendation[];
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: 'When do you expect to need most of this money?',
    options: [
      { label: 'Less than 2 years', description: 'Short-term — capital protection is essential.', points: 0 },
      { label: '2 – 5 years', description: 'Medium-term — some growth, but preserve enough to use soon.', points: 1 },
      { label: '5 – 10 years', description: 'Long-term — time to recover from market downturns.', points: 2 },
      { label: 'More than 10 years', description: 'Very long-term — can ride out significant volatility for higher returns.', points: 3 },
    ],
  },
  {
    id: 2,
    text: 'How stable is your income?',
    options: [
      { label: 'Irregular or variable', description: 'Self-employed, freelance, or income changes significantly month-to-month.', points: 0 },
      { label: 'Somewhat stable', description: 'Employed but income has some uncertainty.', points: 1 },
      { label: 'Stable employment', description: 'Regular salary or predictable income.', points: 2 },
      { label: 'Very stable / multiple sources', description: 'Secure job, rental income, pension, or similar reliable income streams.', points: 3 },
    ],
  },
  {
    id: 3,
    text: 'If your portfolio fell 20% in value over one month, what would you do?',
    options: [
      { label: 'Sell everything and move to cash', description: "I can't stomach large losses.", points: 0 },
      { label: 'Sell some to reduce exposure', description: "I'd want to limit further losses.", points: 1 },
      { label: 'Hold and wait for recovery', description: "I'd be uncomfortable but stay the course.", points: 2 },
      { label: 'Buy more at the lower price', description: "I see downturns as buying opportunities.", points: 3 },
    ],
  },
  {
    id: 4,
    text: 'What is your primary investment goal?',
    options: [
      { label: 'Protect what I have', description: 'Minimal risk — preserving capital matters more than growth.', points: 0 },
      { label: 'Modest, stable growth', description: 'Some growth, but I want to avoid big swings.', points: 1 },
      { label: 'Long-term wealth building', description: "I'm comfortable with ups and downs in pursuit of strong long-term returns.", points: 2 },
      { label: 'Maximum growth', description: "I'll accept high volatility for the highest possible long-term return.", points: 3 },
    ],
  },
  {
    id: 5,
    text: 'Do you have at least 3 months of living expenses saved separately from this investment?',
    options: [
      { label: 'No', description: "I don't have a separate emergency buffer.", points: 0 },
      { label: 'Yes', description: 'My emergency fund is separate and covered.', points: 1 },
    ],
  },
];

export const MAX_SCORE = QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.points)), 0); // 13

export function scoreToTier(score: number): RiskTier {
  if (score <= 3) return 'conservative';
  if (score <= 6) return 'balanced';
  if (score <= 9) return 'growth';
  return 'aggressive';
}

export function calcScore(answers: number[]): number {
  return answers.reduce((sum, optionIdx, qIdx) => {
    const q = QUESTIONS[qIdx];
    return sum + (q?.options[optionIdx]?.points ?? 0);
  }, 0);
}

// Weighted MER helper
export function weightedMer(etfs: EtfRecommendation[]): number {
  return etfs.reduce((sum, e) => sum + (e.allocationPct / 100) * e.mer, 0);
}

// Defensive assets = bonds; everything else (equities, REITs, EM, tech) is growth.
export function etfKind(etf: EtfRecommendation): 'growth' | 'defensive' {
  return etf.category.toLowerCase().includes('bond') ? 'defensive' : 'growth';
}

// Tier definitions — allocations aligned with:
// Vanguard Diversified ETF series (VDCO/VDBA/VDGR/VDHG), Morningstar AU Target Allocation Index,
// and Stockspot portfolio methodology.
export const TIER_PROFILES: Record<RiskTier, TierProfile> = {
  conservative: {
    tier: 'conservative',
    label: 'Conservative',
    growthPct: 30,
    defensivePct: 70,
    description:
      'Your answers suggest capital preservation is your priority. A 30% growth / 70% defensive split protects against large drawdowns while generating modest real returns above inflation. This mirrors the allocation used in Vanguard\'s VDCO and Morningstar\'s AU Conservative Index.',
    sources: [
      'Vanguard Diversified Conservative ETF (VDCO) — 30% growth / 70% defensive',
      'Morningstar AU Target Allocation Conservative Index — ~10% equity, ~90% defensive',
      'Bridgewater All Weather — risk-parity approach emphasising bonds in uncertain environments',
    ],
    etfs: [
      {
        ticker: 'VAF',
        name: 'Vanguard Australian Fixed Interest ETF',
        category: 'AU Bonds',
        allocationPct: 50,
        mer: 0.10,
        aum: '~$2B',
        rationale: 'Core defensive anchor. Tracks the Bloomberg AusBond Composite Index across government and investment-grade corporate bonds. High liquidity, low cost.',
      },
      {
        ticker: 'VIF',
        name: 'Vanguard Intl Fixed Interest ETF (Hedged)',
        category: 'Intl Bonds',
        allocationPct: 20,
        mer: 0.20,
        aum: '~$1B',
        rationale: 'Global bond diversification without currency risk. Currency hedging removes FX noise — critical for a defensive allocation.',
      },
      {
        ticker: 'VAS',
        name: 'Vanguard Australian Shares ETF',
        category: 'AU Equities',
        allocationPct: 20,
        mer: 0.07,
        aum: '~$15B',
        rationale: 'Largest AU ETF by AUM. ASX 300 exposure with franked dividend income — the franking credits benefit AU tax residents meaningfully at this allocation.',
      },
      {
        ticker: 'VGS',
        name: 'Vanguard MSCI Intl Shares ETF',
        category: 'Intl Equities',
        allocationPct: 10,
        mer: 0.18,
        aum: '~$10B',
        rationale: 'Broad developed-market equity exposure across 1,500+ companies in 23 markets. Adds geographic diversification at minimal weight.',
      },
    ],
  },

  balanced: {
    tier: 'balanced',
    label: 'Balanced',
    growthPct: 50,
    defensivePct: 50,
    description:
      'A 50/50 growth-to-defensive split balances long-term growth with meaningful downside protection. This is the classic "balanced" portfolio endorsed by Vanguard (VDBA), Morningstar\'s AU Balanced Index, and Stockspot\'s Sapphire tier — suitable for investors with a medium-to-long time horizon who still want stability.',
    sources: [
      'Vanguard Diversified Balanced ETF (VDBA) — 50% growth / 50% defensive',
      'Morningstar AU Target Allocation Balanced Index — 45% equity, 5% property, 50% defensive',
      'Stockspot Sapphire — 50% growth / 50% defensive',
    ],
    etfs: [
      {
        ticker: 'VAS',
        name: 'Vanguard Australian Shares ETF',
        category: 'AU Equities',
        allocationPct: 30,
        mer: 0.07,
        aum: '~$15B',
        rationale: 'Ultra-low cost (0.07% pa) with strong liquidity (~$15B AUM). Franked dividends provide a tax-effective income stream for AU residents.',
      },
      {
        ticker: 'VGS',
        name: 'Vanguard MSCI Intl Shares ETF',
        category: 'Intl Equities',
        allocationPct: 20,
        mer: 0.18,
        aum: '~$10B',
        rationale: 'MSCI World ex-AU: 23 developed markets. Prevents over-concentration in Australia (only ~2% of global market cap).',
      },
      {
        ticker: 'VAF',
        name: 'Vanguard Australian Fixed Interest ETF',
        category: 'AU Bonds',
        allocationPct: 25,
        mer: 0.10,
        aum: '~$2B',
        rationale: 'Historically negatively correlated to equities in downturns. Acts as a portfolio stabiliser and dampens peak-to-trough drawdowns.',
      },
      {
        ticker: 'VIF',
        name: 'Vanguard Intl Fixed Interest ETF (Hedged)',
        category: 'Intl Bonds',
        allocationPct: 25,
        mer: 0.20,
        aum: '~$1B',
        rationale: 'Adds global bond duration without introducing FX currency risk. Complements VAF for a fully diversified defensive sleeve.',
      },
    ],
  },

  growth: {
    tier: 'growth',
    label: 'Growth',
    growthPct: 70,
    defensivePct: 30,
    description:
      'A 70/30 growth-to-defensive split tilts heavily toward long-term capital appreciation while keeping a 30% defensive buffer to smooth volatility. Aligns with Vanguard\'s VDGR, Morningstar\'s AU Growth Index, and Stockspot\'s Emerald tier. Best suited for investors with a 5-10+ year horizon who can tolerate moderate drawdowns.',
    sources: [
      'Vanguard Diversified Growth ETF (VDGR) — 70% growth / 30% defensive',
      'Morningstar AU Target Allocation Growth Index — 63.5% equity, 6.5% property, 30% defensive',
      'Stockspot Emerald — 70% growth / 30% defensive',
    ],
    etfs: [
      {
        ticker: 'VAS',
        name: 'Vanguard Australian Shares ETF',
        category: 'AU Equities',
        allocationPct: 40,
        mer: 0.07,
        aum: '~$15B',
        rationale: 'Cheapest broad AU equity ETF (0.07% pa). At 40% this is the portfolio\'s return engine; franking credits add meaningful after-tax yield for AU investors.',
      },
      {
        ticker: 'VGS',
        name: 'Vanguard MSCI Intl Shares ETF',
        category: 'Intl Equities',
        allocationPct: 20,
        mer: 0.18,
        aum: '~$10B',
        rationale: 'Broad developed-market exposure. At this allocation avoids any single country or sector dominating the portfolio.',
      },
      {
        ticker: 'VGE',
        name: 'Vanguard FTSE Emerging Markets ETF',
        category: 'Emerging Markets',
        allocationPct: 10,
        mer: 0.48,
        aum: '~$1.5B',
        rationale: 'Long-horizon growth premium from India, China, Brazil and SE Asia. Higher volatility is acceptable at 10% weight with a 10+ year horizon.',
      },
      {
        ticker: 'VAF',
        name: 'Vanguard Australian Fixed Interest ETF',
        category: 'AU Bonds',
        allocationPct: 15,
        mer: 0.10,
        aum: '~$2B',
        rationale: 'Defensive ballast. Even a small bond allocation meaningfully reduces maximum drawdown in equity bear markets.',
      },
      {
        ticker: 'VIF',
        name: 'Vanguard Intl Fixed Interest ETF (Hedged)',
        category: 'Intl Bonds',
        allocationPct: 15,
        mer: 0.20,
        aum: '~$1B',
        rationale: 'Completes the defensive sleeve with global bond duration exposure, hedged to AUD.',
      },
    ],
  },

  aggressive: {
    tier: 'aggressive',
    label: 'Aggressive',
    growthPct: 90,
    defensivePct: 10,
    description:
      'A 90/10 growth-to-defensive split maximises long-term capital growth, accepting significant short-term volatility in exchange. Mirrors Vanguard\'s VDHG and Morningstar\'s AU Aggressive Index. Only appropriate for investors with a 10+ year horizon, stable income, and high tolerance for drawdowns exceeding 30%.',
    sources: [
      'Vanguard Diversified High Growth ETF (VDHG) — 90% growth / 10% defensive',
      'Morningstar AU Target Allocation Aggressive Index — 84% equity, 6% property, 10% defensive',
      'Stockspot Topaz — 78% growth / 22% defensive (high growth)',
    ],
    etfs: [
      {
        ticker: 'VAS',
        name: 'Vanguard Australian Shares ETF',
        category: 'AU Equities',
        allocationPct: 30,
        mer: 0.07,
        aum: '~$15B',
        rationale: 'Lowest-cost AU equity ETF. Franking credits offset some of the higher overall portfolio MER. Highest liquidity of any AU ETF.',
      },
      {
        ticker: 'VGS',
        name: 'Vanguard MSCI Intl Shares ETF',
        category: 'Intl Equities',
        allocationPct: 30,
        mer: 0.18,
        aum: '~$10B',
        rationale: 'Broad developed-market anchor across 23 countries. Prevents over-concentration in any single sector despite the aggressive overall stance.',
      },
      {
        ticker: 'NDQ',
        name: 'BetaShares NASDAQ 100 ETF',
        category: 'US Tech',
        allocationPct: 15,
        mer: 0.48,
        aum: '~$5B',
        rationale: 'Top 100 NASDAQ companies. Highest 10-year growth return of any mainstream AU-listed ETF. Sized at 15% — a meaningful overweight to US tech without letting a single-sector bet dominate the portfolio.',
      },
      {
        ticker: 'VGE',
        name: 'Vanguard FTSE Emerging Markets ETF',
        category: 'Emerging Markets',
        allocationPct: 15,
        mer: 0.48,
        aum: '~$1.5B',
        rationale: 'Emerging-market growth premium at meaningful weight. At 15%, India, China, Brazil and SE Asia materially contribute to long-horizon return.',
      },
      {
        ticker: 'VAF',
        name: 'Vanguard Australian Fixed Interest ETF',
        category: 'AU Bonds',
        allocationPct: 10,
        mer: 0.10,
        aum: '~$2B',
        rationale: 'Defensive buffer sized to match the VDHG benchmark (10%). Bonds dampen worst-case drawdowns in equity bear markets while leaving 90% of the portfolio in growth assets.',
      },
    ],
  },
};
