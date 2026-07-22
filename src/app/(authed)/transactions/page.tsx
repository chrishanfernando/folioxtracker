'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Plus, Search, ArrowDown, ArrowUp, Upload } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useProfile } from '@/components/profile-context';
import { LoadError } from '@/components/load-error';
import { PageSkeleton } from '@/components/page-skeleton';

interface Transaction {
  id: number;
  date: string;
  action: string;
  displayTicker: string;
  assetName: string;
  adjustedQty: number;
  unitPriceAud: number;
  totalAud: number;
  comment: string | null;
}

export default function TransactionsPage() {
  const { profileFetch, activeProfileId } = useProfile();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await profileFetch('/api/transactions');
      if (!res.ok) throw new Error(`transactions fetch failed: ${res.status}`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [profileFetch]);

  useEffect(() => { fetchData(); }, [activeProfileId, fetchData]);

  const filtered = transactions
    .filter(t =>
      !search || t.displayTicker?.toLowerCase().includes(search.toLowerCase()) ||
      t.assetName?.toLowerCase().includes(search.toLowerCase())
    )
    .slice()
    .sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDir === 'asc' ? diff : -diff;
    });

  if (loading) return <AppShell><PageSkeleton variant="table" /></AppShell>;

  if (loadError) {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold mb-6">Transactions</h1>
        <LoadError onRetry={fetchData} />
      </AppShell>
    );
  }

  if (transactions.length === 0) {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold mb-6">Transactions</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">No transactions yet</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Import a CSV from CMC, Stake, Swyftx, or Independent Reserve — or add one by hand.
            </p>
            <div className="flex gap-3">
              <Link href="/import">
                <Button>Import from broker</Button>
              </Link>
              <Link href="/transactions/new">
                <Button variant="outline">Add manually</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Link href="/transactions/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add</Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ticker or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3">
                    <button
                      type="button"
                      onClick={() => setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      aria-label={`Sort by date ${sortDir === 'desc' ? 'oldest first' : 'newest first'}`}
                    >
                      Date
                      {sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                    </button>
                  </th>
                  <th className="text-left p-3">Asset</th>
                  <th className="text-left p-3">Action</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-right p-3">Price</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-accent/50">
                    <td className="p-3">{formatDate(t.date)}</td>
                    <td className="p-3 font-medium">{t.displayTicker}</td>
                    <td className="p-3">
                      <Badge variant={t.action === 'BUY' ? 'default' : 'destructive'} className="text-xs">{t.action}</Badge>
                    </td>
                    <td className="text-right p-3">{Math.abs(t.adjustedQty).toFixed(t.adjustedQty % 1 === 0 ? 0 : 3)}</td>
                    <td className="text-right p-3">${t.unitPriceAud.toFixed(2)}</td>
                    <td className="text-right p-3">${Math.abs(t.totalAud).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-3 text-sm text-muted-foreground">{filtered.length} transactions</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
