'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useProfile } from '@/components/profile-context';

interface CategoryAllocation {
  category: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  threshold: number;
  needsRebalance: boolean;
}

interface BuyRec {
  category: string;
  amountToInvest: number;
  suggestedAssets: { displayTicker: string; amount: number; units: number; currentPrice: number }[];
}

interface ProjectedAlloc {
  category: string;
  currentPct: number;
  projectedPct: number;
  targetPct: number;
}

export default function RebalancePage() {
  const { profileFetch, activeProfileId } = useProfile();
  const [drift, setDrift] = useState<CategoryAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [investAmount, setInvestAmount] = useState('5000');
  const [recommendations, setRecommendations] = useState<BuyRec[]>([]);
  const [projectedAllocation, setProjectedAllocation] = useState<ProjectedAlloc[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targets, setTargets] = useState<{ category: string; targetPct: number; threshold: number }[]>([]);
  const [targetInputs, setTargetInputs] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    profileFetch('/api/rebalance')
      .then(r => r.ok ? r.json() : [])
      .then((data) => {
        const arr: CategoryAllocation[] = Array.isArray(data) ? data : [];
        setDrift(arr);
        const t = arr.map((d) => ({
          category: d.category,
          targetPct: d.targetPct,
          threshold: d.threshold,
        }));
        setTargets(t);
        setTargetInputs(t.map((d) => d.targetPct > 0 ? String(d.targetPct) : ''));
      })
      .finally(() => setLoading(false));
  }, [activeProfileId]);

  async function saveTargets() {
    setSaving(true);
    try {
      const res = await profileFetch('/api/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      });
      const data = await res.json();
      setDrift(data);
      setEditing(false);
      setRecommendations([]);
      setProjectedAllocation([]);
      toast.success('Targets saved');
    } finally {
      setSaving(false);
    }
  }

  async function getBuyRecs() {
    const res = await profileFetch('/api/rebalance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investAmount: parseFloat(investAmount) }),
    });
    const data = await res.json();
    setRecommendations(data.recommendations || []);
    setProjectedAllocation(data.projectedAllocation || []);
  }

  const totalTarget = targets.reduce((sum, t) => sum + t.targetPct, 0);
  const driftingCategories = drift.filter(d => d.needsRebalance);
  const hasTargetsSet = drift.some(d => d.targetPct > 0);

  if (loading) return <AppShell><p className="text-muted-foreground">Loading...</p></AppShell>;

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Rebalancing</h1>

      {/* Drift Alert Banner */}
      {driftingCategories.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="font-semibold text-red-500">Portfolio out of balance</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {driftingCategories.length} {driftingCategories.length === 1 ? 'category has' : 'categories have'} drifted
            beyond threshold: {driftingCategories.map(d => d.category).join(', ')}
          </p>
        </div>
      )}

      {hasTargetsSet && driftingCategories.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="font-semibold text-green-500">Portfolio is balanced</p>
          </div>
          <p className="text-sm text-muted-foreground">All categories are within their drift thresholds.</p>
        </div>
      )}

      {/* Current vs Target Allocation */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Asset Allocation</CardTitle>
              <CardDescription>
                {editing ? 'Set your target percentage for each category. Must sum to 100%.' : 'Current allocation vs your targets.'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit Targets'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium border-b pb-2">
              <div className="col-span-3">Category</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2 text-right">Current</div>
              <div className="col-span-2 text-right">{editing ? 'Target %' : 'Target'}</div>
              <div className="col-span-3 text-right">Drift</div>
            </div>

            {drift.map((d, i) => (
              <div key={d.category}>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="font-medium text-sm">{d.category}</span>
                    {d.needsRebalance && <Badge variant="destructive" className="text-[10px] px-1 py-0">Drift</Badge>}
                  </div>
                  <div className="col-span-2 text-right text-sm text-muted-foreground">
                    ${d.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="col-span-2 text-right text-sm">
                    {d.currentPct.toFixed(1)}%
                  </div>
                  <div className="col-span-2 text-right">
                    {editing ? (
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        className="w-20 h-8 text-sm ml-auto"
                        value={targetInputs[i] ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const newInputs = [...targetInputs];
                          newInputs[i] = raw;
                          setTargetInputs(newInputs);
                          const newTargets = [...targets];
                          newTargets[i] = { ...newTargets[i], targetPct: raw === '' ? 0 : parseFloat(raw) };
                          setTargets(newTargets);
                        }}
                      />
                    ) : (
                      <span className="text-sm">{d.targetPct > 0 ? `${d.targetPct.toFixed(1)}%` : '—'}</span>
                    )}
                  </div>
                  <div className="col-span-3 text-right">
                    {d.targetPct > 0 ? (
                      <span className={`text-sm flex items-center justify-end gap-1 ${
                        Math.abs(d.driftPct) > d.threshold ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {d.driftPct > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : d.driftPct < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : null}
                        {d.driftPct > 0 ? '+' : ''}{d.driftPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                {/* Visual bar */}
                <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-blue-500 rounded-full absolute"
                    style={{ width: `${Math.min(d.currentPct, 100)}%` }}
                  />
                  {d.targetPct > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/60"
                      style={{ left: `${Math.min(d.targetPct, 100)}%` }}
                    />
                  )}
                </div>
              </div>
            ))}

            {/* Totals Row */}
            <div className="grid grid-cols-12 gap-2 items-center border-t pt-3 font-medium text-sm">
              <div className="col-span-3">Total</div>
              <div className="col-span-2 text-right">
                ${drift.reduce((s, d) => s + d.currentValue, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="col-span-2 text-right">
                {drift.reduce((s, d) => s + d.currentPct, 0).toFixed(1)}%
              </div>
              <div className={`col-span-2 text-right ${editing && Math.abs(totalTarget - 100) > 0.1 ? 'text-red-500' : ''}`}>
                {totalTarget > 0 ? `${totalTarget.toFixed(1)}%` : '—'}
              </div>
              <div className="col-span-3" />
            </div>

            {editing && (
              <div className="flex items-center justify-between pt-2">
                {Math.abs(totalTarget - 100) > 0.1 && (
                  <p className="text-sm text-red-500">Targets must sum to 100%</p>
                )}
                <Button
                  onClick={saveTargets}
                  disabled={Math.abs(totalTarget - 100) > 0.1 || saving}
                  className="ml-auto"
                >
                  {saving ? 'Saving...' : 'Save Targets'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Buy Recommender */}
      {hasTargetsSet && (
        <Card>
          <CardHeader>
            <CardTitle>Buy Recommender</CardTitle>
            <CardDescription>
              Enter an amount to invest and see what to buy to move closer to your targets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div>
                <Label>Amount to invest (AUD)</Label>
                <Input
                  type="number"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={getBuyRecs}>Calculate</Button>
            </div>

            {recommendations.length > 0 && (() => {
              const totalSpend = recommendations.reduce((sum, r) =>
                sum + r.suggestedAssets.reduce((s, a) => {
                  const units = a.units < 1 ? a.units : Math.floor(a.units);
                  return s + units * a.currentPrice;
                }, 0), 0);

              return (
                <div className="space-y-3 mt-4">
                  <h3 className="font-semibold text-sm">What to buy:</h3>
                  {recommendations.map((r) => {
                    const categorySpend = r.suggestedAssets.reduce((s, a) => {
                      const units = a.units < 1 ? a.units : Math.floor(a.units);
                      return s + units * a.currentPrice;
                    }, 0);

                    return (
                      <div key={r.category} className="border rounded-lg p-3">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium">{r.category}</span>
                          <span className="text-green-500 font-medium">
                            ${categorySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {r.suggestedAssets.map((a) => {
                            const units = a.units < 1 ? a.units : Math.floor(a.units);
                            const cost = units * a.currentPrice;
                            return (
                              <div key={a.displayTicker} className="flex justify-between">
                                <span>{a.displayTicker} <span className="text-xs">@ ${a.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                                <span>
                                  {a.units < 1
                                    ? `${units.toFixed(6)} units`
                                    : `${units} units`}
                                  {' '}= ${cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between pt-2 border-t text-sm font-medium">
                    <span>Total spend</span>
                    <span>${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} of ${parseFloat(investAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              );
            })()}

            {projectedAllocation.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-3">Projected allocation after investment:</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground font-medium border-b pb-2">
                    <div>Category</div>
                    <div className="text-right">Current</div>
                    <div className="text-right">After</div>
                    <div className="text-right">Target</div>
                  </div>
                  {projectedAllocation.filter(p => p.targetPct > 0 || p.currentPct > 0).map((p) => {
                    const improved = Math.abs(p.projectedPct - p.targetPct) < Math.abs(p.currentPct - p.targetPct);
                    return (
                      <div key={p.category} className="grid grid-cols-4 gap-2 text-sm">
                        <div className="font-medium">{p.category}</div>
                        <div className="text-right text-muted-foreground">{p.currentPct.toFixed(1)}%</div>
                        <div className={`text-right ${improved ? 'text-green-500' : ''}`}>
                          {p.projectedPct.toFixed(1)}%
                        </div>
                        <div className="text-right">{p.targetPct > 0 ? `${p.targetPct.toFixed(1)}%` : '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!hasTargetsSet && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Set your target allocations above to enable buy recommendations and drift alerts.
            </p>
            <Button onClick={() => setEditing(true)}>Set Targets</Button>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
