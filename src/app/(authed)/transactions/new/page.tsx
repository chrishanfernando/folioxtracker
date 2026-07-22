'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useProfile } from '@/components/profile-context';
import { Plus, Search } from 'lucide-react';

interface Asset {
  id: number;
  displayTicker: string;
  name: string;
}

export default function NewTransactionPage() {
  const router = useRouter();
  const { profileFetch, activeProfileId } = useProfile();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isNewAsset, setIsNewAsset] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [assetError, setAssetError] = useState(false);
  
  const [form, setForm] = useState({
    assetId: '',
    date: new Date().toISOString().split('T')[0],
    action: 'BUY',
    quantity: '',
    unitPriceAud: '',
    unitPriceLocal: '',
    fxRate: '',
    feeAud: '',
    comment: '',
  });

  const [newAssetForm, setNewAssetForm] = useState({
    symbol: '',
    name: '',
    yahooSymbol: '',
    category: '',
    platform: '',
  });

  useEffect(() => {
    profileFetch('/api/assets')
      .then(r => r.json())
      .then((data: Asset[]) => setAssets(data))
      .catch(() => setAssets([]));

    profileFetch('/api/assets/options')
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories || []);
        setPlatforms(data.platforms || []);
      });
  }, [activeProfileId, profileFetch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setAssetError(false);
    if (!isNewAsset && !form.assetId) {
      setAssetError(true);
      return;
    }
    setSubmitting(true);
    try {
      let finalAssetId = parseInt(form.assetId);

      if (isNewAsset) {
        const assetRes = await profileFetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...newAssetForm,
            displayTicker: newAssetForm.symbol,
          }),
        });
        if (!assetRes.ok) {
          const err = await assetRes.json();
          toast.error(err.error || 'Failed to create asset');
          return;
        }
        const newAsset = await assetRes.json();
        finalAssetId = newAsset.id;
      }

      if (isNaN(finalAssetId)) {
        toast.error('Please select or create an asset');
        return;
      }

      const res = await profileFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: finalAssetId,
          date: form.date,
          action: form.action,
          quantity: parseFloat(form.quantity),
          unitPriceAud: parseFloat(form.unitPriceAud),
          unitPriceLocal: form.unitPriceLocal ? parseFloat(form.unitPriceLocal) : null,
          fxRate: form.fxRate ? parseFloat(form.fxRate) : null,
          feeAud: form.feeAud ? parseFloat(form.feeAud) : null,
          comment: form.comment || null,
        }),
      });
      if (res.ok) {
        toast.success('Transaction added');
        router.push('/transactions');
      } else {
        toast.error('Failed to add transaction');
      }
    } catch {
      toast.error('Error adding transaction');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Add Transaction</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Asset Details</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsNewAsset(!isNewAsset)}
                  className="text-xs text-primary"
                >
                  {isNewAsset ? (
                    <span className="flex items-center gap-1"><Search className="h-3 w-3" /> Select existing</span>
                  ) : (
                    <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Add new asset</span>
                  )}
                </Button>
              </div>

              {isNewAsset ? (
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-accent/10">
                  <div className="col-span-2">
                    <Label>Asset Name</Label>
                    <Input 
                      placeholder="e.g. Vanguard Australian Shares" 
                      value={newAssetForm.name} 
                      onChange={e => setNewAssetForm({...newAssetForm, name: e.target.value})}
                      required={isNewAsset}
                    />
                  </div>
                  <div>
                    <Label>Symbol</Label>
                    <Input 
                      placeholder="e.g. VAS" 
                      value={newAssetForm.symbol} 
                      onChange={e => {
                        const s = e.target.value.toUpperCase();
                        setNewAssetForm({...newAssetForm, symbol: s, yahooSymbol: s.includes('.') ? s : `${s}.AX`});
                      }}
                      required={isNewAsset}
                    />
                  </div>
                  <div>
                    <Label>Yahoo Symbol</Label>
                    <Input 
                      placeholder="e.g. VAS.AX" 
                      value={newAssetForm.yahooSymbol} 
                      onChange={e => setNewAssetForm({...newAssetForm, yahooSymbol: e.target.value.toUpperCase()})}
                      required={isNewAsset}
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input 
                      placeholder="e.g. AU Equities" 
                      list="categories"
                      value={newAssetForm.category} 
                      onChange={e => setNewAssetForm({...newAssetForm, category: e.target.value})}
                      required={isNewAsset}
                    />
                    <datalist id="categories">
                      {categories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label>Platform</Label>
                    <Input 
                      placeholder="e.g. CMC" 
                      list="platforms"
                      value={newAssetForm.platform} 
                      onChange={e => setNewAssetForm({...newAssetForm, platform: e.target.value})}
                    />
                    <datalist id="platforms">
                      {platforms.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="asset-select" className="sr-only">Asset</Label>
                  <Select
                    value={form.assetId}
                    onValueChange={(v) => { setForm({ ...form, assetId: v }); setAssetError(false); }}
                  >
                    <SelectTrigger id="asset-select" className="w-full" aria-invalid={assetError} aria-describedby={assetError ? 'asset-error' : undefined}>
                      <SelectValue placeholder="Select asset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.displayTicker} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assetError && (
                    <p id="asset-error" className="text-xs text-destructive mt-1.5">Please select an asset, or add a new one.</p>
                  )}
                  {assets.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      No assets found. Click &quot;Add new asset&quot; above to create one.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-semibold">Transaction Details</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tx-date">Date</Label>
                  <Input id="tx-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="action-select">Action</Label>
                  <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                    <SelectTrigger id="action-select" className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tx-qty">Quantity</Label>
                  <Input id="tx-qty" type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="tx-price">Unit Price (AUD)</Label>
                  <Input id="tx-price" type="number" step="any" value={form.unitPriceAud} onChange={(e) => setForm({ ...form, unitPriceAud: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Unit Price (Local, optional)</Label>
                  <Input type="number" step="any" value={form.unitPriceLocal} onChange={(e) => setForm({ ...form, unitPriceLocal: e.target.value })} />
                </div>
                <div>
                  <Label>FX Rate (optional)</Label>
                  <Input type="number" step="any" value={form.fxRate} onChange={(e) => setForm({ ...form, fxRate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brokerage (AUD, optional)</Label>
                  <Input type="number" step="any" min="0" placeholder="blank = unknown" value={form.feeAud} onChange={(e) => setForm({ ...form, feeAud: e.target.value })} />
                </div>
                <div>
                  <Label>Comment (optional)</Label>
                  <Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={submitting}>{submitting ? 'Adding…' : 'Add Transaction'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
