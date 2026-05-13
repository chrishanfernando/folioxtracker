'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TimeFrameFilter, filterByTimeFrame, type TimeFrame } from '@/components/time-frame-filter';
import { InlineSelect } from '@/components/inline-select';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer } from 'recharts';
import { ZoomableChart } from '@/components/zoomable-chart';
import { AnimatedNumber } from '@/components/animated-number';
import { useProfile } from '@/components/profile-context';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface DashboardData {
  summary: {
    totalValue: number;
    totalCost: number;
    profitLoss: number;
    returnPct: number;
    cagr: number;
    holdings: Array<{
      assetId: number;
      displayTicker: string;
      name: string;
      category: string;
      platform: string;
      quantity: number;
      totalCostAud: number;
      marketValueAud: number;
      profitLossPct: number;
      profitLossAud: number;
      cagr: number;
    }>;
    categoryBreakdown: Array<{ category: string; value: number; pct: number }>;
  };
  history: Array<{ date: string; value: number; cost: number }>;
}

export default function DashboardPage() {
  const { profileFetch, activeProfileId } = useProfile();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'cost' | 'value' | 'pl' | 'return' | 'cagr'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('ALL');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [driftCategories, setDriftCategories] = useState<string[]>([]);

  async function fetchData() {
    try {
      const [dashRes, optsRes, rebalRes] = await Promise.all([
        profileFetch('/api/dashboard'),
        profileFetch('/api/assets/options'),
        profileFetch('/api/rebalance'),
      ]);
      const json = dashRes.ok ? await dashRes.json() : null;
      const opts = optsRes.ok ? await optsRes.json() : {};
      const rebalData = rebalRes.ok ? await rebalRes.json() : [];
      setData(json && json.summary ? json : null);
      setPlatforms(Array.isArray(opts.platforms) ? opts.platforms : []);
      setCategories(Array.isArray(opts.categories) ? opts.categories : []);
      const drifting = (Array.isArray(rebalData) ? rebalData : [] as { category: string; needsRebalance: boolean }[])
        .filter((d) => d.needsRebalance)
        .map((d) => d.category);
      // Browser notification if new drift detected
      if (drifting.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        setDriftCategories(prev => {
          const newDrifts = drifting.filter(c => !prev.includes(c));
          if (newDrifts.length > 0) {
            new Notification('Portfolio Drift Alert', {
              body: `${newDrifts.join(', ')} ${newDrifts.length === 1 ? 'has' : 'have'} drifted beyond threshold`,
              icon: '/favicon.ico',
            });
          }
          return drifting;
        });
      } else {
        setDriftCategories(drifting);
      }
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function updateAsset(assetId: number, field: 'platform' | 'category', value: string) {
    await profileFetch(`/api/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    // Update local state
    if (data) {
      const updated = { ...data };
      const holding = updated.summary.holdings.find(h => h.assetId === assetId);
      if (holding) holding[field] = value;
      setData(updated);
    }
    toast.success(`${field} updated`);
  }

  async function refreshPrices() {
    setRefreshing(true);
    try {
      await fetch('/api/prices/fetch?force=true', { method: 'POST' });
      toast.success('Prices updated');
      await fetchData();
    } catch {
      toast.error('Failed to refresh prices');
    } finally {
      setRefreshing(false);
    }
  }

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    // Initial load: fetch prices then dashboard data
    fetch('/api/prices/fetch', { method: 'POST' })
      .finally(() => fetchData());

    // Auto-refresh every 60 seconds while page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetch('/api/prices/fetch', { method: 'POST' })
          .then(() => profileFetch('/api/dashboard'))
          .then(r => r.json())
          .then(json => setData(json))
          .catch(() => {});
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [activeProfileId]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div></AppShell>;

  const s = data?.summary;

  if (!s || s.holdings.length === 0) {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">No holdings yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Add your first transaction to start tracking your portfolio.
            </p>
            <Link href="/transactions/new">
              <Button>Add transaction</Button>
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={refreshPrices} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Prices
        </Button>
      </div>

      {/* Drift Alert */}
      {driftCategories.length > 0 && (
        <Link href="/rebalance" className="block mb-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 hover:bg-red-500/15 transition-colors">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="font-semibold text-red-500 text-sm">Portfolio out of balance</p>
                <p className="text-xs text-muted-foreground">
                  {driftCategories.join(', ')} {driftCategories.length === 1 ? 'has' : 'have'} drifted beyond threshold. Tap to rebalance.
                </p>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <AnimatedNumber value={`$${s?.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <AnimatedNumber value={`$${s?.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              {(s?.profitLoss || 0) >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(s?.profitLoss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <AnimatedNumber value={`$${s?.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-4 w-4" /> Return
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(s?.returnPct || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <AnimatedNumber value={`${s?.returnPct.toFixed(1)}%`} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">CAGR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <AnimatedNumber value={`${s?.cagr.toFixed(1)}%`} />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Portfolio Value Over Time</CardTitle>
            <TimeFrameFilter value={timeFrame} onChange={setTimeFrame} />
          </CardHeader>
          <CardContent>
            <ZoomableChart
              data={filterByTimeFrame(data?.history || [], timeFrame)}
              lines={[
                { dataKey: 'value', stroke: '#3b82f6', strokeWidth: 2, name: 'Value' },
                { dataKey: 'cost', stroke: '#666', strokeWidth: 1, strokeDasharray: '5 5', name: 'Cost Basis' },
              ]}
              yFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tooltipFormatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, '']}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={s?.categoryBreakdown}
                  dataKey="value"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  startAngle={90}
                  endAngle={-270}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={((props: any) => `${props.name || ''} ${((props.percent || 0) * 100).toFixed(0)}%`) as any}
                >
                  {s?.categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <PieTooltip formatter={(v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4">Asset</th>
                  <th className="text-left py-2 pr-4 hidden md:table-cell">Category</th>
                  <th className="text-left py-2 pr-4 hidden md:table-cell">Platform</th>
                  <th className="text-right py-2 pr-4">Units</th>
                  {([['cost', 'Cost'], ['value', 'Value'], ['pl', 'P&L'], ['return', 'Return'], ['cagr', 'CAGR']] as const).map(([key, label]) => (
                    <th
                      key={key}
                      className="text-right py-2 pr-4 cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => {
                        if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                        else { setSortBy(key); setSortDir('desc'); }
                      }}
                    >
                      {label} {sortBy === key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s?.holdings
                  .slice()
                  .sort((a, b) => {
                    const m = sortDir === 'desc' ? -1 : 1;
                    if (sortBy === 'cost') return m * (a.totalCostAud - b.totalCostAud);
                    if (sortBy === 'value') return m * (a.marketValueAud - b.marketValueAud);
                    if (sortBy === 'pl') return m * (a.profitLossAud - b.profitLossAud);
                    if (sortBy === 'cagr') return m * (a.cagr - b.cagr);
                    return m * (a.profitLossPct - b.profitLossPct);
                  })
                  .map((h) => (
                    <tr key={h.assetId} className="border-b hover:bg-accent/50">
                      <td className="py-2 pr-4">
                        <a href={`/holdings/${h.assetId}`} className="hover:underline font-medium">
                          {h.displayTicker}
                        </a>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground hidden md:table-cell">
                        <InlineSelect
                          value={h.category}
                          options={categories}
                          onSave={(v) => updateAsset(h.assetId, 'category', v)}
                        />
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground hidden md:table-cell">
                        <InlineSelect
                          value={h.platform}
                          options={platforms}
                          onSave={(v) => updateAsset(h.assetId, 'platform', v)}
                        />
                      </td>
                      <td className="text-right py-2 pr-4">{h.quantity % 1 === 0 ? h.quantity : h.quantity.toFixed(3)}</td>
                      <td className="text-right py-2 pr-4">${h.totalCostAud.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="text-right py-2 pr-4">
                        <AnimatedNumber value={`$${h.marketValueAud.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                      </td>
                      <td className={`text-right py-2 pr-4 ${h.profitLossAud >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <AnimatedNumber value={`$${h.profitLossAud.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                      </td>
                      <td className={`text-right py-2 pr-4 ${h.profitLossPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <AnimatedNumber value={`${h.profitLossPct.toFixed(1)}%`} />
                      </td>
                      <td className={`text-right py-2 ${h.cagr >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <AnimatedNumber value={`${h.cagr.toFixed(1)}%`} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
