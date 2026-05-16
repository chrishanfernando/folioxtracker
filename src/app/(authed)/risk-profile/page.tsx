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
  type RiskTier,
  type EtfRecommendation,
} from '@/lib/risk-profiling';
import { ChevronLeft, ChevronRight, RotateCcw, Target, ExternalLink } from 'lucide-react';

type View = 'loading' | 'quiz' | 'results';

const TIER_COLORS: Record<RiskTier, string> = {
  conservative: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  balanced:     'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  growth:       'bg-amber-500/10 text-amber-600 border-amber-500/30',
  aggressive:   'bg-red-500/10 text-red-600 border-red-500/30',
};

const ALLOCATION_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
];

function EtfCard({ etf, color }: { etf: EtfRecommendation; color: string }) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">{etf.ticker}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              {etf.allocationPct}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{etf.name}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <Badge variant="outline" className="text-xs">{etf.mer.toFixed(2)}% pa MER</Badge>
          <p className="text-xs text-muted-foreground">{etf.aum} AUM</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{etf.rationale}</p>
    </div>
  );
}

function AllocationBar({ etfs }: { etfs: EtfRecommendation[] }) {
  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-full overflow-hidden w-full">
        {etfs.map((etf, i) => (
          <div
            key={etf.ticker}
            style={{ width: `${etf.allocationPct}%`, backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }}
            title={`${etf.ticker} ${etf.allocationPct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {etfs.map((etf, i) => (
          <div key={etf.ticker} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }}
            />
            <span className="font-medium">{etf.ticker}</span>
            <span className="text-muted-foreground">{etf.allocationPct}%</span>
          </div>
        ))}
      </div>
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
  }

  async function submitQuiz() {
    setSaving(true);
    try {
      const res = await profileFetch('/api/risk-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      setSavedTier(data.riskTier as RiskTier);
      setSavedScore(data.riskScore);
      setSavedAnswers(answers);
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
              Answer 5 questions to get a personalised ETF allocation recommendation.
            </p>
          </div>

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

          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>

            {isLastStep ? (
              <Button
                onClick={submitQuiz}
                disabled={selectedOption === -1 || saving}
              >
                {saving ? 'Saving…' : 'See My Results'}
              </Button>
            ) : (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={selectedOption === -1}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
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

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
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
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${TIER_COLORS[tier]}`}>
                {profile.label} Investor
              </span>
              <span className="text-sm text-muted-foreground">
                Score: {score} / {MAX_SCORE}
              </span>
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
              <span className="font-semibold text-foreground">{(wMer * 100).toFixed(2)}% pa</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationBar etfs={profile.etfs} />
          </CardContent>
        </Card>

        {/* ETF cards */}
        <div>
          <h2 className="text-sm font-semibold mb-3">Recommended ETFs</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {profile.etfs.map((etf, i) => (
              <EtfCard
                key={etf.ticker}
                etf={etf}
                color={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]}
              />
            ))}
          </div>
        </div>

        {/* Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Methodology & Sources</CardTitle>
            <CardDescription>
              These allocations are based on publicly available frameworks from established fund managers and index providers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {profile.sources.map((s, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-muted-foreground/50">•</span>
                {s}
              </p>
            ))}
            <div className="pt-2 flex flex-wrap gap-3 text-xs">
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
