'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/components/profile-context';
import { LoadError } from '@/components/load-error';
import { PageSkeleton } from '@/components/page-skeleton';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface FeesResponse {
  weightedMerBps: number | null;
  projectedAnnualMerAud: number | null;
  totalValueAud: number;
  holdings: Array<{
    assetId: number;
    ticker: string;
    marketValueAud: number;
    merBps: number | null;
    annualCostAud: number | null;
  }>;
  lifetimeBrokerageAud: number;
  unknownBrokerageCount: number;
  comparisonAdvisor: { name: string; feeBps: number; projectedAnnualAud: number };
  dragProjection: Array<{ years: number; withFeesAud: number; withoutFeesAud: number; lostAud: number }>;
}

function fmtAud(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(bps: number | null | undefined): string {
  if (bps == null) return '—';
  return `${(bps / 100).toFixed(2)}%`;
}

export default function FeesPage() {
  const { profileFetch, activeProfileId } = useProfile();
  const [data, setData] = useState<FeesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await profileFetch('/api/fees');
      if (!res.ok) throw new Error(`fees fetch failed: ${res.status}`);
      setData(await res.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [profileFetch]);

  useEffect(() => { fetchData(); }, [activeProfileId, fetchData]);

  if (loading) return <AppShell><PageSkeleton variant="cards" /></AppShell>;

  if (loadError) {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold mb-4">Fees &amp; cost transparency</h1>
        <LoadError onRetry={fetchData} />
      </AppShell>
    );
  }

  if (!data || data.holdings.length === 0) {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold mb-4">Fees & cost transparency</h1>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground space-y-3">
            <p>No holdings yet. Import transactions or add one manually to see your fund-fee summary.</p>
            <div className="flex gap-3">
              <Link href="/import" className="underline">Import data</Link>
              <Link href="/transactions/new" className="underline">Add transaction</Link>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { weightedMerBps, projectedAnnualMerAud, holdings, comparisonAdvisor, dragProjection, lifetimeBrokerageAud, unknownBrokerageCount } = data;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Fees & cost transparency</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What you actually pay to own your portfolio. Fund management fees baked into ETF prices, plus brokerage paid at trade time.
          </p>
        </div>

        {unknownBrokerageCount > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="pt-4 flex items-start gap-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                {unknownBrokerageCount} transaction{unknownBrokerageCount === 1 ? '' : 's'} {unknownBrokerageCount === 1 ? 'is' : 'are'} missing brokerage data. Edit them on the{' '}
                <Link href="/transactions" className="underline">transactions page</Link>{' '}
                to make the lifetime brokerage total accurate.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Headline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Weighted fund fee</CardDescription>
              <CardTitle className="text-3xl">{fmtPct(weightedMerBps)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {projectedAnnualMerAud == null
                ? 'No MER data available yet.'
                : `${fmtAud(projectedAnnualMerAud)} per year at current balance.`}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Lifetime brokerage paid</CardDescription>
              <CardTitle className="text-3xl">{fmtAud(lifetimeBrokerageAud)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Total brokerage captured across imported and manual transactions.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{comparisonAdvisor.name} (comparison)</CardDescription>
              <CardTitle className="text-3xl">{fmtAud(comparisonAdvisor.projectedAnnualAud)}/yr</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              At {fmtPct(comparisonAdvisor.feeBps)} on a {fmtAud(data.totalValueAud)} portfolio.{' '}
              <Link href="/settings" className="underline">Change baseline</Link>
            </CardContent>
          </Card>
        </div>

        {/* Per-holding table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-holding fund fees</CardTitle>
            <CardDescription>Click a row to edit the MER for that holding.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y text-muted-foreground">
                    <th className="text-left p-3">Asset</th>
                    <th className="text-right p-3">Market value</th>
                    <th className="text-right p-3">MER</th>
                    <th className="text-right p-3">Annual cost</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.assetId} className="border-b hover:bg-accent/30">
                      <td className="p-3">
                        <Link href={`/holdings/${h.assetId}`} className="font-medium underline-offset-2 hover:underline">
                          {h.ticker}
                        </Link>
                      </td>
                      <td className="text-right p-3">{fmtAud(h.marketValueAud)}</td>
                      <td className="text-right p-3">
                        {h.merBps == null ? <Badge variant="outline">unknown</Badge> : fmtPct(h.merBps)}
                      </td>
                      <td className="text-right p-3">{fmtAud(h.annualCostAud)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Drag projection */}
        {dragProjection.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fee drag over time</CardTitle>
              <CardDescription>
                What your balance reaches with and without the weighted fund fee, assuming a constant
                7% nominal gross return, no contributions, no withdrawals, no tax. Directional only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dragProjection} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="years" tickFormatter={(v) => `${v}y`} />
                    <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => fmtAud(typeof v === 'number' ? v : null)} />
                    <Legend />
                    <Bar dataKey="withoutFeesAud" name="Without fees" fill="#10b981" />
                    <Bar dataKey="withFeesAud" name="With fund fees" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                {dragProjection.map((d) => (
                  <div key={d.years} className="rounded border p-2">
                    <div className="text-muted-foreground">In {d.years} years you would lose</div>
                    <div className="text-lg font-semibold">{fmtAud(d.lostAud)}</div>
                    <div className="text-muted-foreground">to fund fees</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
