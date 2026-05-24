'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ZoomableChart } from '@/components/zoomable-chart';
import { TimeFrameFilter, filterByTimeFrame, type TimeFrame } from '@/components/time-frame-filter';
import { toast } from 'sonner';
import { Pencil, Trash2, Check, X, MessageSquare } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useProfile } from '@/components/profile-context';
import { useChartColors } from '@/lib/theme-colors';

interface Transaction {
  id: number;
  date: string;
  action: string;
  quantity: number;
  unitPriceAud: number;
  totalAud: number;
  adjustedQty: number;
  source: string | null;
  comment: string | null;
}

interface AssetDetail {
  asset: { id: number; symbol: string; name: string; displayTicker: string; category: string; platform: string };
  transactions: Transaction[];
  priceHistory: Array<{ date: string; priceAud: number }>;
  holding: { quantity: number; avgCost: number; totalCost: number; currentPrice: number; marketValue: number; profitLoss: number; profitLossPct: number };
}

interface EditState {
  date: string;
  action: string;
  quantity: string;
  unitPriceAud: string;
  source: string;
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profileFetch } = useProfile();
  const chartColors = useChartColors();
  const [data, setData] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('ALL');
  const [showClose, setShowClose] = useState(false);
  const [closePrice, setClosePrice] = useState('');
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [closing, setClosing] = useState(false);
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('desc');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ date: '', action: '', quantity: '', unitPriceAud: '', source: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [commentEditId, setCommentEditId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');

  async function fetchData() {
    const r = await profileFetch(`/api/holdings/${params.id}`);
    const d = await r.json();
    setData(d);
    if (d.holding?.currentPrice) setClosePrice(d.holding.currentPrice.toFixed(2));
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [params.id]);

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setEditState({
      date: tx.date,
      action: tx.action,
      quantity: Math.abs(tx.adjustedQty).toString(),
      unitPriceAud: tx.unitPriceAud.toString(),
      source: tx.source || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(txId: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editState.date,
          action: editState.action,
          quantity: parseFloat(editState.quantity),
          unitPriceAud: parseFloat(editState.unitPriceAud),
          source: editState.source || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Transaction updated');
        setEditingId(null);
        await fetchData();
      } else {
        toast.error(result.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update transaction');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTx(txId: number) {
    setDeletingId(txId);
    try {
      const res = await fetch(`/api/transactions/${txId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Transaction deleted');
        await fetchData();
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete transaction');
    } finally {
      setDeletingId(null);
    }
  }

  async function saveComment(txId: number) {
    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText || null }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Comment saved');
        setCommentEditId(null);
        await fetchData();
      }
    } catch {
      toast.error('Failed to save comment');
    }
  }

  async function handleClose() {
    if (!closePrice) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/holdings/${params.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceAud: parseFloat(closePrice), date: closeDate }),
      });
      const result = await res.json();
      if (result.success) {
        const pl = result.profitLoss;
        toast.success(`Position closed. P&L: ${pl >= 0 ? '+' : ''}$${pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        router.push('/holdings');
      } else {
        toast.error(result.error || 'Failed to close position');
      }
    } catch {
      toast.error('Failed to close position');
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <AppShell><p className="text-muted-foreground">Loading...</p></AppShell>;
  if (!data) return <AppShell><p>Asset not found</p></AppShell>;

  const { asset, holding, priceHistory, transactions } = data;

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{asset.displayTicker}</h1>
          <p className="text-muted-foreground">{asset.name}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{asset.category}</Badge>
            <Badge variant="outline">{asset.platform}</Badge>
          </div>
        </div>
        {holding.quantity > 0.0001 && (
          <Button variant="destructive" size="sm" onClick={() => setShowClose(!showClose)}>
            {showClose ? 'Cancel' : 'Close Position'}
          </Button>
        )}
      </div>

      {/* Close Position Form */}
      {showClose && (
        <Card className="mb-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-base">Close Position — Sell all {holding.quantity.toFixed(holding.quantity % 1 === 0 ? 0 : 8)} units</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sale Price (AUD per unit)</Label>
                <Input
                  type="number"
                  step="any"
                  value={closePrice}
                  onChange={e => setClosePrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Sale Date</Label>
                <Input
                  type="date"
                  value={closeDate}
                  onChange={e => setCloseDate(e.target.value)}
                />
              </div>
            </div>
            {closePrice && (
              <p className="text-sm text-muted-foreground">
                Total: ${(holding.quantity * parseFloat(closePrice || '0')).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {' · '}
                P&L: <span className={(holding.quantity * parseFloat(closePrice || '0') - holding.totalCost) >= 0 ? 'text-green-500' : 'text-red-500'}>
                  ${(holding.quantity * parseFloat(closePrice || '0') - holding.totalCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </p>
            )}
            <Button variant="destructive" onClick={handleClose} disabled={closing || !closePrice}>
              {closing ? 'Closing...' : 'Confirm Close Position'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Market Value</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">${holding.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cost Basis</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">${holding.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">P&L</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${holding.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${holding.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({holding.profitLossPct.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Quantity</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{holding.quantity.toFixed(holding.quantity % 1 === 0 ? 0 : 8)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Cost</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">${holding.avgCost.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Current Price</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">${holding.currentPrice.toFixed(2)}</p></CardContent>
        </Card>
      </div>

      {/* Price Chart */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Price History (AUD)</CardTitle>
          <TimeFrameFilter value={timeFrame} onChange={setTimeFrame} />
        </CardHeader>
        <CardContent>
          <ZoomableChart
            data={filterByTimeFrame(priceHistory, timeFrame)}
            lines={[
              { dataKey: 'priceAud', stroke: chartColors.lineColors.value, strokeWidth: 2 },
            ]}
            yFormatter={(v) => `$${v.toFixed(2)}`}
            tooltipFormatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price (AUD)']}
            markers={transactions.map(tx => ({
              date: tx.date,
              label: `${tx.action} ${Math.abs(tx.adjustedQty).toFixed(tx.adjustedQty % 1 === 0 ? 0 : 3)} @ $${tx.unitPriceAud.toFixed(2)}`,
              color: tx.action === 'BUY' ? '#22c55e' : '#ef4444',
            }))}
          />
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th
                    className="text-left py-2 cursor-pointer select-none hover:text-foreground"
                    onClick={() => setDateSort(d => d === 'asc' ? 'desc' : 'asc')}
                  >
                    Date {dateSort === 'asc' ? '↑' : '↓'}
                  </th>
                  <th className="text-left py-2">Action</th>
                  <th className="text-left py-2 hidden md:table-cell">Platform</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Cumulative</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Total</th>
                  <th className="text-right py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const chronological = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
                  const cumulativeMap = new Map<number, number>();
                  let running = 0;
                  for (const tx of chronological) {
                    running += tx.action === 'BUY' ? Math.abs(tx.adjustedQty) : -Math.abs(tx.adjustedQty);
                    cumulativeMap.set(tx.id, running);
                  }

                  const sorted = [...transactions].sort((a, b) =>
                    dateSort === 'asc'
                      ? a.date.localeCompare(b.date) || a.id - b.id
                      : b.date.localeCompare(a.date) || b.id - a.id
                  );

                  const isFractional = transactions.some(t => t.adjustedQty % 1 !== 0);
                  const fmt = (n: number) => isFractional ? n.toFixed(8) : n.toFixed(0);

                  return sorted.map((tx) => {
                    const isEditing = editingId === tx.id;

                    if (isEditing) {
                      return (
                        <tr key={tx.id} className="border-b bg-accent/30">
                          <td className="py-1">
                            <Input
                              type="date"
                              value={editState.date}
                              onChange={e => setEditState(s => ({ ...s, date: e.target.value }))}
                              className="h-8 text-xs w-[130px]"
                            />
                          </td>
                          <td className="py-1">
                            <select
                              value={editState.action}
                              onChange={e => setEditState(s => ({ ...s, action: e.target.value }))}
                              className="h-8 rounded border bg-background px-2 text-xs"
                            >
                              <option value="BUY">BUY</option>
                              <option value="SELL">SELL</option>
                            </select>
                          </td>
                          <td className="py-1 hidden md:table-cell">
                            <Input
                              value={editState.source}
                              onChange={e => setEditState(s => ({ ...s, source: e.target.value }))}
                              className="h-8 text-xs w-[100px]"
                              placeholder="Source"
                            />
                          </td>
                          <td className="py-1">
                            <Input
                              type="number"
                              step="any"
                              value={editState.quantity}
                              onChange={e => setEditState(s => ({ ...s, quantity: e.target.value }))}
                              className="h-8 text-xs text-right w-[100px] ml-auto"
                            />
                          </td>
                          <td className="text-right py-1 text-muted-foreground">—</td>
                          <td className="py-1">
                            <Input
                              type="number"
                              step="any"
                              value={editState.unitPriceAud}
                              onChange={e => setEditState(s => ({ ...s, unitPriceAud: e.target.value }))}
                              className="h-8 text-xs text-right w-[90px] ml-auto"
                            />
                          </td>
                          <td className="text-right py-1 text-muted-foreground text-xs">
                            ${(parseFloat(editState.quantity || '0') * parseFloat(editState.unitPriceAud || '0')).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="text-right py-1">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(tx.id)} disabled={saving}>
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const isCommentEditing = commentEditId === tx.id;

                    return (
                      <>
                        <tr key={tx.id} className="border-b group">
                          <td className="py-2">{formatDate(tx.date)}</td>
                          <td className="py-2">
                            <Badge variant={tx.action === 'BUY' ? 'default' : 'destructive'}>{tx.action}</Badge>
                          </td>
                          <td className="py-2 text-muted-foreground hidden md:table-cell">{tx.source || '—'}</td>
                          <td className="text-right py-2">{fmt(Math.abs(tx.adjustedQty))}</td>
                          <td className="text-right py-2 text-muted-foreground">{fmt(cumulativeMap.get(tx.id) ?? 0)}</td>
                          <td className="text-right py-2">${tx.unitPriceAud.toFixed(2)}</td>
                          <td className="text-right py-2">${Math.abs(tx.totalAud).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="text-right py-2">
                            <div className="flex gap-1 justify-end">
                              <button
                                className={`h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent ${tx.comment ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                                title={tx.comment || 'Add comment'}
                                onClick={() => {
                                  if (isCommentEditing) {
                                    setCommentEditId(null);
                                  } else {
                                    setCommentEditId(tx.id);
                                    setCommentText(tx.comment || '');
                                  }
                                }}
                              >
                                <MessageSquare className={`h-3.5 w-3.5 ${tx.comment ? 'text-blue-400' : 'text-muted-foreground'}`} />
                              </button>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(tx)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  disabled={deletingId === tx.id}
                                  onClick={() => {
                                    if (confirm('Delete this transaction?')) deleteTx(tx.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isCommentEditing && (
                          <tr key={`comment-${tx.id}`} className="border-b bg-accent/20">
                            <td colSpan={8} className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={commentText}
                                  onChange={e => setCommentText(e.target.value)}
                                  placeholder="Add a note..."
                                  className="h-8 text-xs flex-1"
                                  onKeyDown={e => { if (e.key === 'Enter') saveComment(tx.id); if (e.key === 'Escape') setCommentEditId(null); }}
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveComment(tx.id)}>
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCommentEditId(null)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
