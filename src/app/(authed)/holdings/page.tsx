'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { useProfile } from '@/components/profile-context';

interface Holding {
  assetId: number;
  displayTicker: string;
  name: string;
  category: string;
  platform: string;
  quantity: number;
  avgCostAud: number;
  totalCostAud: number;
  currentPriceAud: number;
  marketValueAud: number;
  profitLossAud: number;
  profitLossPct: number;
}

interface ClosedHolding {
  assetId: number;
  displayTicker: string;
  name: string;
  category: string;
  platform: string;
  totalBought: number;
  totalSold: number;
  totalCostAud: number;
  totalProceedsAud: number;
  realisedPL: number;
}

export default function HoldingsPage() {
  const { profileFetch, activeProfileId } = useProfile();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [closed, setClosed] = useState<ClosedHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setLoading(true);
    profileFetch('/api/holdings')
      .then(r => r.json())
      .then(data => {
        setHoldings(data.holdings || []);
        setClosed(data.closed || []);
      })
      .finally(() => setLoading(false));
  }, [activeProfileId]);

  if (loading) return <AppShell><p className="text-muted-foreground">Loading...</p></AppShell>;

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Holdings</h1>
      <div className="grid gap-4">
        {holdings
          .sort((a, b) => b.marketValueAud - a.marketValueAud)
          .map((h) => (
            <Link key={h.assetId} href={`/holdings/${h.assetId}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold">{h.displayTicker}</p>
                    <p className="text-sm text-muted-foreground">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{h.category} · {h.platform} · {h.quantity.toFixed(h.quantity % 1 === 0 ? 0 : 3)} units</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${h.marketValueAud.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p className={`text-sm ${h.profitLossAud >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {h.profitLossAud >= 0 ? '+' : ''}${h.profitLossAud.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      ({h.profitLossPct >= 0 ? '+' : ''}{h.profitLossPct.toFixed(1)}%)
                    </p>
                    <p className="text-xs text-muted-foreground">@ ${h.currentPriceAud.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>

      {/* Archived / Closed Positions */}
      {closed.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <Archive className="h-4 w-4" />
            <span className="text-sm font-medium">Archived ({closed.length})</span>
            <span className="text-xs">{showArchived ? '▲' : '▼'}</span>
          </button>

          {showArchived && (
            <div className="grid gap-4">
              {closed
                .sort((a, b) => b.totalCostAud - a.totalCostAud)
                .map((h) => (
                  <Link key={h.assetId} href={`/holdings/${h.assetId}`}>
                    <Card className="hover:bg-accent/50 transition-colors opacity-70">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-semibold">{h.displayTicker}</p>
                          <p className="text-sm text-muted-foreground">{h.name}</p>
                          <p className="text-xs text-muted-foreground">{h.category} · {h.platform}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Closed</p>
                          <p className={`text-sm ${h.realisedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {h.realisedPL >= 0 ? '+' : ''}${h.realisedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })} realised
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cost ${h.totalCostAud.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Proceeds ${h.totalProceedsAud.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
