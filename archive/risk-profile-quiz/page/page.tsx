'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useProfile } from '@/components/profile-context';
import Link from 'next/link';
import {
  QUESTIONS,
  MAX_SCORE,
  TIER_PROFILES,
  weightedMer,
  etfKind,
  type RiskTier,
  type EtfRecommendation,
} from '@/lib/risk-profiling';
import { GeneralAdviceBanner } from '@/components/general-advice-banner';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Target,
  ExternalLink,
  Shield,
  Scale,
  Sprout,
  Rocket,
  type LucideIcon,
} from 'lucide-react';

type View = 'loading' | 'quiz' | 'results';

const TIER_COLORS: Record<RiskTier, string> = {
  conservative: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  balanced:     'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  growth:       'bg-amber-500/10 text-amber-600 border-amber-500/30',
  aggressive:   'bg-red-500/10 text-red-600 border-red-500/30',
};

const TIER_ICONS: Record<RiskTier, LucideIcon> = {
  conservative: Shield,
  balanced:     Scale,
  growth:       Sprout,
  aggressive:   Rocket,
};

const TIER_ICON_RING: Record<RiskTier, string> = {
  conservative: 'bg-blue-500/10 text-blue-600 ring-blue-500/20',
  balanced:     'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
  growth:       'bg-amber-500/10 text-amber-600 ring-amber-500/20',
  aggressive:   'bg-red-500/10 text-red-600 ring-red-500/20',
};

const TIER_TAGLINE: Record<RiskTier, string> = {
  conservative: 'Protect what you have',
  balanced:     'Steady growth with stability',
  growth:       'Long-term wealth building',
  aggressive:   'Maximum long-term growth',
};

// Growth = warm palette (amber/red/violet/orange). Defensive = cool palette (blue/slate).
const GROWTH_COLORS    = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const DEFENSIVE_COLORS = ['#3b82f6', '#0ea5e9'];

function colorFor(etf: EtfRecommendation, growthIdx: number, defensiveIdx: number): string {
  return etfKind(etf) === 'growth'
    ? GROWTH_COLORS[growthIdx % GROWTH_COLORS.length]
    : DEFENSIVE_COLORS[defensiveIdx % DEFENSIVE_COLORS.length];
}

// Assign a stable color per ETF based on its position within its own (growth/defensive) group.
function buildColorMap(etfs: EtfRecommendation[]): Record<string, string> {
  let g = 0, d = 0;
  const map: Record<string, string> = {};
  for (const etf of etfs) {
    if (etfKind(etf) === 'growth') map[etf.ticker] = colorFor(etf, g++, 0);
    else map[etf.ticker] = colorFor(etf, 0, d++);
  }
  return map;
}

function EtfCard({ etf, color }: { etf: EtfRecommendation; color: string }) {
  const kind = etfKind(etf);
  const asxUrl = `https://www2.asx.com.au/markets/company/${etf.ticker.toLowerCase()}`;
  return (
    <div className="border rounded-lg p-4 space-y-2 min-w-0">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={asxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-bold hover:underline inline-flex items-center gap-1"
              title={`View ${etf.ticker} on ASX`}
            >
              {etf.ticker}
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {etf.allocationPct}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{etf.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium whitespace-nowrap">{etf.mer.toFixed(2)}% MER</p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">{etf.aum} AUM</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant="outline"
          className={`text-xs ${kind === 'growth'
            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
            : 'bg-blue-500/10 text-blue-600 border-blue-500/30'}`}
        >
          {kind === 'growth' ? 'Growth' : 'Defensive'}
        </Badge>
        <Badge variant="outline" className="text-xs">{etf.category}</Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{etf.rationale}</p>
    </div>
  );
}

function AllocationBar({ etfs, colorMap }: { etfs: EtfRecommendation[]; colorMap: Record<string, string> }) {
  // Order growth-first for a clean visual split in the bar.
  const ordered = [...etfs].sort((a, b) => {
    const ak = etfKind(a) === 'growth' ? 0 : 1;
    const bk = etfKind(b) === 'growth' ? 0 : 1;
    return ak - bk;
  });
  const growth = ordered.filter(e => etfKind(e) === 'growth');
  const defensive = ordered.filter(e => etfKind(e) === 'defensive');

  const Legend = ({ items, label, labelClass }: { items: EtfRecommendation[]; label: string; labelClass: string }) => (
    items.length === 0 ? null : (
      <div className="space-y-1">
        <p className={`text-xs font-semibold ${labelClass}`}>{label}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {items.map((etf) => (
            <div key={etf.ticker} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: colorMap[etf.ticker] }}
              />
              <span className="font-medium">{etf.ticker}</span>
              <span className="text-muted-foreground">{etf.category} · {etf.allocationPct}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  );

  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-full overflow-hidden w-full">
        {ordered.map((etf) => (
          <div
            key={etf.ticker}
            style={{ width: `${etf.allocationPct}%`, backgroundColor: colorMap[etf.ticker] }}
            title={`${etf.ticker} ${etf.allocationPct}% (${etfKind(etf)})`}
          />
        ))}
      </div>
      <Legend items={growth} label="Growth" labelClass="text-amber-600" />
      <Legend items={defensive} label="Defensive" labelClass="text-blue-600" />
    </div>
  );
}

export default function RiskProfilePage() {
  const { profileFetch, activeProfileId } = useProfile();

  const [view, setView] = useState<View>('loading');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [methodologyExpanded, setMethodologyExpanded] = useState(false);

  // Saved result
  const [savedTier, setSavedTier] = useState<RiskTier | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<number[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setView('loading');
    profileFetch('/api/risk-profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSavedTier(data.riskTier as RiskTier);
          setSavedScore(data.riskScore);
          setSavedAnswers(data.answers);
          setAnswers(data.answers);
          setView('results');
        } else {
          setView('quiz');
        }
      })
      .catch(() => setView('quiz'));
  }, [activeProfileId]);

  const currentQ = QUESTIONS[step];
  const selectedOption = answers[step] ?? -1;
  const isLastStep = step === QUESTIONS.length - 1;

  function selectOption(optionIdx: number) {
    const next = [...answers];
    next[step] = optionIdx;
    setAnswers(next);

    // Auto-advance: give a short delay so the selected-state ring is visible
    // before transitioning. On the last question, submit instead of advancing.
    const isLast = step === QUESTIONS.length - 1;
    setTimeout(() => {
      if (isLast) {
        submitQuiz(next);
      } else {
        setStep(s => s + 1);
      }
    }, 180);
  }

  async function submitQuiz(finalAnswers: number[] = answers) {
    setSaving(true);
    try {
      const res = await profileFetch('/api/risk-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const data = await res.json();
      setSavedTier(data.riskTier as RiskTier);
      setSavedScore(data.riskScore);
      setSavedAnswers(finalAnswers);
      setSavedAt(new Date().toISOString());
      setView('results');
    } catch {
      toast.error('Failed to save results');
    } finally {
      setSaving(false);
    }
  }

  async function applyToRebalance() {
    setApplying(true);
    try {
      await profileFetch('/api/risk-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: savedAnswers, applyTargets: true }),
      });
      toast.success('Rebalance targets updated — head to Rebalancing to review.');
    } catch {
      toast.error('Failed to apply targets');
    } finally {
      setApplying(false);
    }
  }

  function retake() {
    setStep(0);
    setAnswers([]);
    setView('quiz');
  }

  if (view === 'loading') {
    return <AppShell><p className="text-muted-foreground">Loading...</p></AppShell>;
  }

  // ── Quiz view ────────────────────────────────────────────────────────────────
  if (view === 'quiz') {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Risk Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Answer 5 questions to get an educational ETF allocation example.
            </p>
          </div>

          <GeneralAdviceBanner />

          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Question {step + 1} of {QUESTIONS.length}</span>
              <span>{Math.round(((step) / QUESTIONS.length) * 100)}% complete</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((step) / QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base leading-snug">{currentQ.text}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentQ.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => selectOption(i)}
                  className={`w-full text-left border rounded-lg p-4 transition-all ${
                    selectedOption === i
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:border-muted-foreground/40 hover:bg-accent/50'
                  }`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0 || saving}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>

            {saving && isLastStep && (
              <span className="text-sm text-muted-foreground">Saving…</span>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Results view ─────────────────────────────────────────────────────────────
  const tier = savedTier!;
  const score = savedScore!;
  const profile = TIER_PROFILES[tier];
  const wMer = weightedMer(profile.etfs);
  const colorMap = buildColorMap(profile.etfs);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <GeneralAdviceBanner />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Your Risk Profile</h1>
            {savedAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last updated {new Date(savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={retake}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retake
          </Button>
        </div>

        {/* Tier summary */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div
                className={`shrink-0 rounded-full p-4 ring-4 ${TIER_ICON_RING[tier]}`}
                aria-hidden="true"
              >
                {(() => {
                  const Icon = TIER_ICONS[tier];
                  return <Icon className="h-8 w-8" strokeWidth={1.75} />;
                })()}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${TIER_COLORS[tier]}`}>
                    {profile.label} Investor
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Score: {score} / {MAX_SCORE}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{TIER_TAGLINE[tier]}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{profile.description}</p>

            {/* Growth / Defensive split */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent/50 p-3 text-center">
                <p className="text-2xl font-bold">{profile.growthPct}%</p>
                <p className="text-xs text-muted-foreground">Growth assets</p>
              </div>
              <div className="rounded-lg bg-accent/50 p-3 text-center">
                <p className="text-2xl font-bold">{profile.defensivePct}%</p>
                <p className="text-xs text-muted-foreground">Defensive assets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allocation bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recommended Allocation</CardTitle>
            <CardDescription>
              Weighted portfolio MER:{' '}
              <span className="font-semibold text-foreground">{wMer.toFixed(2)}% pa</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationBar etfs={profile.etfs} colorMap={colorMap} />
          </CardContent>
        </Card>

        {/* ETF cards */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Recommended ETFs</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {profile.etfs.map((etf) => (
              <EtfCard
                key={etf.ticker}
                etf={etf}
                color={colorMap[etf.ticker]}
              />
            ))}
          </div>
        </div>

        {/* Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Methodology & Sources</CardTitle>
            <CardDescription>
              How your tier was determined and where the allocation comes from.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed">
            {/* Short summary — always visible */}
            <p className="text-muted-foreground">
              Five questions score you on time horizon, income stability, loss tolerance, and investment goal (plus an
              emergency-fund safety check) for a total out of {MAX_SCORE}. Your score of{' '}
              <span className="font-semibold text-foreground">{score}/{MAX_SCORE}</span> placed you in the{' '}
              <span className="font-semibold text-foreground">{profile.label}</span> tier, which targets a{' '}
              <span className="font-semibold text-foreground">{profile.growthPct}% growth / {profile.defensivePct}% defensive</span>{' '}
              split. The split is anchored to three independent Australian benchmarks (Vanguard Diversified ETFs, Morningstar
              Target Allocation Indices, and Stockspot model portfolios) so no single house view dominates the recommendation.
            </p>

            <button
              type="button"
              onClick={() => setMethodologyExpanded(v => !v)}
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              aria-expanded={methodologyExpanded}
            >
              {methodologyExpanded ? (
                <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>Show more detail <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </button>

            {methodologyExpanded && (
              <div className="space-y-4 pt-2 border-t">
            {/* Scoring */}
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">How the questionnaire scores you</h3>
              <p className="text-muted-foreground">
                Five questions cover the four dimensions that academic and industry research treat as the strongest
                predictors of suitable portfolio risk: <span className="font-medium text-foreground">time horizon</span> (how
                long until you need the money), <span className="font-medium text-foreground">income stability</span> (your
                capacity to ride out drawdowns without forced selling), <span className="font-medium text-foreground">loss
                tolerance</span> (your behavioural response to a 20% drop), and <span className="font-medium text-foreground">investment
                goal</span>. A fifth question on emergency-fund coverage acts as a safety floor — without a buffer, even risk-tolerant
                investors may be forced to sell at the worst time.
              </p>
              <p className="text-muted-foreground">
                Each answer carries 0–3 points (the emergency-fund question is 0–1). Your total (out of {MAX_SCORE}) maps to a tier:
              </p>
              <ul className="text-muted-foreground space-y-0.5 pl-4 list-disc marker:text-muted-foreground/50">
                <li><span className="font-medium text-foreground">0–3</span> → Conservative (30/70)</li>
                <li><span className="font-medium text-foreground">4–6</span> → Balanced (50/50)</li>
                <li><span className="font-medium text-foreground">7–9</span> → Growth (70/30)</li>
                <li><span className="font-medium text-foreground">10–{MAX_SCORE}</span> → Aggressive (90/10)</li>
              </ul>
              <p className="text-muted-foreground">
                You scored <span className="font-semibold text-foreground">{score}/{MAX_SCORE}</span>, placing you in the{' '}
                <span className="font-semibold text-foreground">{profile.label}</span> tier.
              </p>
            </section>

            {/* Growth vs Defensive */}
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">Growth vs Defensive assets</h3>
              <p className="text-muted-foreground">
                <span className="font-medium text-amber-600">Growth assets</span> (equities — Australian shares, international
                shares, emerging markets, sector tilts like US tech) have historically returned 7–10% pa over long horizons but
                can fall 30–50% in bear markets. They drive long-term wealth.
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-blue-600">Defensive assets</span> (high-grade bonds — both Australian and
                hedged international) typically return 2–5% pa but rarely drop more than 5–10% in a year. Their job isn't return
                — it's reducing peak-to-trough drawdowns and providing dry powder to rebalance into equities during downturns.
              </p>
              <p className="text-muted-foreground">
                The ratio between the two is the single biggest driver of long-term portfolio outcomes — far more important than
                individual stock picks.
              </p>
            </section>

            {/* Benchmark anchoring */}
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">Why these specific allocations?</h3>
              <p className="text-muted-foreground">
                The growth/defensive splits for each tier are anchored to three independent, publicly documented benchmarks
                from established Australian fund managers and index providers. This avoids any single house view dominating
                the recommendation:
              </p>
              <ul className="text-muted-foreground space-y-0.5 pl-4 list-disc marker:text-muted-foreground/50">
                <li>
                  <span className="font-medium text-foreground">Vanguard Diversified ETF series</span> (VDCO/VDBA/VDGR/VDHG) —
                  the four-tier 30/50/70/90 growth split is taken directly from Vanguard's own multi-asset ETFs.
                </li>
                <li>
                  <span className="font-medium text-foreground">Morningstar AU Target Allocation Indices</span> — independent
                  benchmark indices used by financial advisers across Australia to set target asset allocations.
                </li>
                <li>
                  <span className="font-medium text-foreground">Stockspot model portfolios</span> — a digital-advice firm whose
                  five risk tiers are publicly disclosed and roughly match the splits used here.
                </li>
              </ul>
              <p className="text-muted-foreground">
                Specific ETF selection within each tier favours <span className="font-medium text-foreground">low MER</span>{' '}
                (lower fees compound to large differences over decades), <span className="font-medium text-foreground">high
                AUM</span> (better liquidity, lower bid-ask spreads), and <span className="font-medium text-foreground">broad,
                index-tracking exposure</span> rather than concentrated active bets.
              </p>
            </section>

            {/* Tier-specific sources */}
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">Benchmarks for your tier</h3>
              <ul className="space-y-1">
                {profile.sources.map((s, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 text-muted-foreground/50">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Caveats */}
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">Caveats</h3>
              <p className="text-muted-foreground">
                A five-question quiz cannot capture your full circumstances. Tax situation (franking-credit value,
                CGT discount, super vs non-super), existing assets (property, business equity), debt, dependants and insurance
                cover all materially affect what allocation is genuinely appropriate. Treat this as a structured starting
                point — not a substitute for personal financial advice.
              </p>
              <p className="text-muted-foreground">
                MER and AUM figures shown are indicative and may be out of date. Click any ETF ticker above to view current
                figures on the ASX listing page.
              </p>
            </section>

            {/* External links */}
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">Further reading</h3>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://fund-docs.vanguard.com/AU-ETFPDS-Vanguard_Diversified_Index_ETFs-VDCO-VDBA-VDGR-VDHG.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Vanguard Diversified ETF PDS <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://www.bridgewater.com/research-and-insights/the-all-weather-story"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Bridgewater All Weather <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://blog.stockspot.com.au/what-is-your-risk-profile/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Stockspot risk methodology <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </section>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Apply CTA */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Apply to Rebalance Targets</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will overwrite your current category targets on the Rebalancing page with the
                  allocation above. You can adjust them manually afterwards.
                </p>
                <div className="flex gap-3 mt-3">
                  <Button onClick={applyToRebalance} disabled={applying} size="sm">
                    {applying ? 'Applying…' : 'Apply Targets'}
                  </Button>
                  <Link href="/rebalance">
                    <Button variant="outline" size="sm">Go to Rebalancing</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center pb-2">
          This is a general educational tool, not personal financial advice. ETF fees and AUM are indicative.
          Verify current figures with the relevant fund provider before investing.
        </p>
      </div>
    </AppShell>
  );
}
