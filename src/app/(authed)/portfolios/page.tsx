'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useProfile } from '@/components/profile-context';
import Link from 'next/link';
import {
  MODEL_PORTFOLIOS,
  MODEL_PORTFOLIO_ORDER,
  weightedMer,
  etfKind,
  type RiskTier,
  type EtfRecommendation,
} from '@/lib/model-portfolios';
import { GeneralAdviceBanner } from '@/components/general-advice-banner';
import {
  ChevronDown,
  ChevronUp,
  Target,
  ExternalLink,
  Shield,
  Scale,
  Sprout,
  Rocket,
  type LucideIcon,
} from 'lucide-react';

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
  conservative: 'Protect capital, modest growth',
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

export default function PortfoliosPage() {
  const { profileFetch } = useProfile();

  const [selected, setSelected] = useState<RiskTier>('balanced');
  const [applying, setApplying] = useState(false);
  const [methodologyExpanded, setMethodologyExpanded] = useState(false);

  const profile = MODEL_PORTFOLIOS[selected];
  const wMer = weightedMer(profile.etfs);
  const colorMap = buildColorMap(profile.etfs);
  const Icon = TIER_ICONS[selected];

  async function applyAsTemplate() {
    setApplying(true);
    try {
      const res = await profileFetch('/api/portfolios/apply-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selected }),
      });
      if (!res.ok) throw new Error();
      toast.success('Copied to your rebalance targets — head to Rebalancing to review and edit.');
    } catch {
      toast.error('Failed to copy template');
    } finally {
      setApplying(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Example Portfolios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Illustrative model portfolios built from low-cost Australian ETFs, anchored to public
            benchmarks. Browse them for ideas — they are general examples, not tailored to you.
          </p>
        </div>

        <GeneralAdviceBanner />

        {/* Tier selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODEL_PORTFOLIO_ORDER.map((tier) => {
            const p = MODEL_PORTFOLIOS[tier];
            const active = tier === selected;
            return (
              <button
                key={tier}
                onClick={() => { setSelected(tier); setMethodologyExpanded(false); }}
                className={`rounded-lg border p-3 text-left transition-all ${
                  active
                    ? `${TIER_COLORS[tier]} ring-1`
                    : 'hover:border-muted-foreground/40 hover:bg-accent/50'
                }`}
                aria-pressed={active}
              >
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.growthPct}/{p.defensivePct} split</p>
              </button>
            );
          })}
        </div>

        {/* Portfolio summary */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className={`shrink-0 rounded-full p-4 ring-4 ${TIER_ICON_RING[selected]}`} aria-hidden="true">
                <Icon className="h-8 w-8" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${TIER_COLORS[selected]}`}>
                  {profile.label} example
                </span>
                <p className="text-sm font-medium text-foreground">{TIER_TAGLINE[selected]}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{profile.description}</p>

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
            <CardTitle className="text-sm">Example Allocation</CardTitle>
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
          <h2 className="text-sm font-semibold mb-3">ETFs in this example</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {profile.etfs.map((etf) => (
              <EtfCard key={etf.ticker} etf={etf} color={colorMap[etf.ticker]} />
            ))}
          </div>
        </div>

        {/* Methodology */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Methodology & Sources</CardTitle>
            <CardDescription>Where these example allocations come from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed">
            <p className="text-muted-foreground">
              The four examples target{' '}
              <span className="font-semibold text-foreground">30/50/70/90% growth</span> splits. Each split is
              anchored to three independent Australian benchmarks (Vanguard Diversified ETFs, Morningstar Target
              Allocation Indices, and Stockspot model portfolios) so no single house view dominates. The higher the
              growth allocation, the higher the expected long-term return — and the larger the potential drawdowns.
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
                <section className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Growth vs Defensive assets</h3>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-amber-600">Growth assets</span> (equities — Australian shares,
                    international shares, emerging markets, sector tilts like US tech) have historically returned 7–10% pa
                    over long horizons but can fall 30–50% in bear markets. They drive long-term wealth.
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-blue-600">Defensive assets</span> (high-grade bonds — both
                    Australian and hedged international) typically return 2–5% pa but rarely drop more than 5–10% in a
                    year. Their job isn't return — it's reducing peak-to-trough drawdowns and providing dry powder to
                    rebalance into equities during downturns.
                  </p>
                  <p className="text-muted-foreground">
                    The ratio between the two is the single biggest driver of long-term portfolio outcomes — far more
                    important than individual stock picks.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Why these specific allocations?</h3>
                  <p className="text-muted-foreground">
                    The growth/defensive splits are anchored to three independent, publicly documented benchmarks from
                    established Australian fund managers and index providers:
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
                    ETF selection within each example favours <span className="font-medium text-foreground">low MER</span>,{' '}
                    <span className="font-medium text-foreground">high AUM</span> (better liquidity), and{' '}
                    <span className="font-medium text-foreground">broad, index-tracking exposure</span> rather than
                    concentrated active bets.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Benchmarks for this example</h3>
                  <ul className="space-y-1">
                    {profile.sources.map((s, i) => (
                      <li key={i} className="text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0 text-muted-foreground/50">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Caveats</h3>
                  <p className="text-muted-foreground">
                    These are general examples, not tailored to anyone. Your tax situation, existing assets, debt,
                    dependants, and goals all materially affect what is genuinely appropriate. Treat these as a
                    structured starting point — not a substitute for personal financial advice.
                  </p>
                  <p className="text-muted-foreground">
                    MER and AUM figures shown are indicative and may be out of date. Click any ETF ticker above to view
                    current figures on the ASX listing page.
                  </p>
                </section>

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

        {/* Use-as-template CTA */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Use this example as a target template</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Copies this example's category split into your own Rebalancing targets as a starting point,
                  overwriting your current targets. You choose whether to use it and can edit the targets afterwards.
                </p>
                <div className="flex gap-3 mt-3">
                  <Button onClick={applyAsTemplate} disabled={applying} size="sm">
                    {applying ? 'Copying…' : 'Copy to my targets'}
                  </Button>
                  <Link href="/rebalance">
                    <Button variant="outline" size="sm">Go to Rebalancing</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center pb-2">
          General educational examples, not personal financial advice. ETF fees and AUM are indicative.
          Verify current figures with the relevant fund provider before investing.
        </p>
      </div>
    </AppShell>
  );
}
