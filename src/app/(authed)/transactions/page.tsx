'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useProfile } from '@/components/profile-context';

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
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    profileFetch('/api/transactions')
      .then(r => r.ok ? r.json() : [])
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [activeProfileId]);

  const filtered = transactions.filter(t =>
    !search || t.displayTicker?.toLowerCase().includes(search.toLowerCase()) ||
    t.assetName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <AppShell><p className="text-muted-foreground">Loading...</p></AppShell>;

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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3">Date</th>
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
