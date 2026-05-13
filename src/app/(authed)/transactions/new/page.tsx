'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useProfile } from '@/components/profile-context';

interface Asset {
  id: number;
  displayTicker: string;
  name: string;
}

export default function NewTransactionPage() {
  const router = useRouter();
  const { profileFetch, activeProfileId } = useProfile();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState({
    assetId: '',
    date: new Date().toISOString().split('T')[0],
    action: 'BUY',
    quantity: '',
    unitPriceAud: '',
    unitPriceLocal: '',
    fxRate: '',
    comment: '',
  });

  useEffect(() => {
    profileFetch('/api/holdings')
      .then(r => r.json())
      .then((data: { holdings: Array<{ assetId: number; displayTicker: string; name: string }> }) =>
        setAssets((data.holdings || []).map(h => ({ id: h.assetId, displayTicker: h.displayTicker, name: h.name })))
      );
  }, [activeProfileId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: parseInt(form.assetId),
          date: form.date,
          action: form.action,
          quantity: parseFloat(form.quantity),
          unitPriceAud: parseFloat(form.unitPriceAud),
          unitPriceLocal: form.unitPriceLocal ? parseFloat(form.unitPriceLocal) : null,
          fxRate: form.fxRate ? parseFloat(form.fxRate) : null,
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
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Add Transaction</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <Label>Asset</Label>
              <select
                className="w-full mt-1 bg-background border rounded-md p-2 text-sm"
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                required
              >
                <option value="">Select asset...</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.displayTicker} - {a.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div>
                <Label>Action</Label>
                <select
                  className="w-full mt-1 bg-background border rounded-md p-2 text-sm"
                  value={form.action}
                  onChange={(e) => setForm({ ...form, action: e.target.value })}
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input type="number" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div>
                <Label>Unit Price (AUD)</Label>
                <Input type="number" step="any" value={form.unitPriceAud} onChange={(e) => setForm({ ...form, unitPriceAud: e.target.value })} required />
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
            <div>
              <Label>Comment (optional)</Label>
              <Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Add Transaction</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
