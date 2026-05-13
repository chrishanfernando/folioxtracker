'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ZoomableChart } from '@/components/zoomable-chart';
import { TimeFrameFilter, filterByTimeFrame, type TimeFrame } from '@/components/time-frame-filter';
import { useProfile } from '@/components/profile-context';
import { Plus, X, Search } from 'lucide-react';
import Link from 'next/link';

interface ChartData {
  assetId?: number;
  displayTicker: string;
  name: string;
  priceHistory: Array<{ date: string; priceAud: number }>;
  profitLossPct?: number;
  isCustom?: boolean;
}

export default function ChartsPage() {
  const { profileFetch, activeProfileId } = useProfile();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [customCharts, setCustomCharts] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1Y');
  const [searchTicker, setSearchTicker] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    setLoading(true);
    profileFetch('/api/holdings/charts')
      .then(r => r.ok ? r.json() : [])
      .then(data => setCharts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [activeProfileId]);

  async function addTicker() {
    const ticker = searchTicker.trim().toUpperCase();
    if (!ticker) return;

    const allCharts = [...charts, ...customCharts];
    if (allCharts.some(c => c.displayTicker.toUpperCase() === ticker)) {
      setSearchError('Already showing this ticker');
      return;
    }

    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/charts/lookup?symbol=${encodeURIComponent(ticker)}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || 'Not found');
        return;
      }
      setCustomCharts(prev => [...prev, {
        displayTicker: data.symbol,
        name: data.name,
        priceHistory: data.priceHistory,
        isCustom: true,
      }]);
      setSearchTicker('');
    } catch {
      setSearchError('Failed to fetch');
    } finally {
      setSearching(false);
    }
  }

  function removeCustom(ticker: string) {
    setCustomCharts(prev => prev.filter(c => c.displayTicker !== ticker));
  }

  if (loading) return <AppShell><p className="text-muted-foreground">Loading...</p></AppShell>;

  const allCharts = [...charts, ...customCharts];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Price Charts</h1>
        <TimeFrameFilter value={timeFrame} onChange={setTimeFrame} extended />
      </div>

      {/* Add ticker */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTicker}
            onChange={e => { setSearchTicker(e.target.value); setSearchError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') addTicker(); }}
            placeholder="Add ticker (e.g. AAPL, VAS.AX)"
            className="pl-9 h-9"
          />
        </div>
        <Button size="sm" onClick={addTicker} disabled={searching || !searchTicker.trim()} className="h-9">
          <Plus className="h-4 w-4 mr-1" />
          {searching ? 'Loading...' : 'Add'}
        </Button>
        {searchError && <p className="text-xs text-red-500 self-center">{searchError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {allCharts.map((c) => {
          const filtered = filterByTimeFrame(c.priceHistory, timeFrame);
          const first = filtered[0]?.priceAud;
          const last = filtered[filtered.length - 1]?.priceAud;
          const changePct = first && last ? ((last - first) / first) * 100 : 0;

          // Calculate drawdown from peak
          const peak = Math.max(...filtered.map(p => p.priceAud));
          const drawdownPct = peak > 0 && last ? ((last - peak) / peak) * 100 : 0;

          const chartCard = (
            <Card className={`transition-colors ${c.isCustom ? '' : 'hover:bg-accent/30'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{c.displayTicker}</CardTitle>
                    {c.isCustom && (
                      <button onClick={() => removeCustom(c.displayTicker)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium ${changePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                    </span>
                    {drawdownPct < -0.5 && (
                      <span className="text-xs text-orange-400 ml-2">
                        {drawdownPct.toFixed(1)}% from peak
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{c.name}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <ZoomableChart
                  data={filtered}
                  lines={[
                    { dataKey: 'priceAud', stroke: changePct >= 0 ? '#22c55e' : '#ef4444', strokeWidth: 1.5 },
                  ]}
                  yFormatter={(v) => `$${v.toFixed(0)}`}
                  tooltipFormatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
                  height={180}
                />
              </CardContent>
            </Card>
          );

          if (c.assetId && !c.isCustom) {
            return <Link key={c.assetId} href={`/holdings/${c.assetId}`}>{chartCard}</Link>;
          }
          return <div key={c.displayTicker}>{chartCard}</div>;
        })}
      </div>
    </AppShell>
  );
}
