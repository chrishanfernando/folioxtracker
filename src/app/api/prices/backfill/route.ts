import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, asc, desc } from 'drizzle-orm';
import { fetchHistoricalPrices, fetchCurrentPrices } from '@/lib/prices';
import { requireUser } from '@/lib/auth-helpers';

export async function POST() {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;
    const assets = await db.select().from(schema.assets).where(eq(schema.assets.isActive, true));

    // Find earliest transaction date
    const firstTx = await db.select()
      .from(schema.transactions)
      .orderBy(asc(schema.transactions.date))
      .limit(1);

    const startDate = firstTx[0]?.date || '2017-03-01';
    const results: { symbol: string; weekly: number; daily: number }[] = [];

    for (const asset of assets) {
      try {
        const isAud = asset.yahooSymbol.endsWith('.AX') || asset.yahooSymbol.endsWith('-AUD');

        // 1. Weekly data from the beginning (covers the bulk of history)
        const weekly = await fetchHistoricalPrices(asset.id, asset.yahooSymbol, isAud, startDate, '1wk');

        // 2. Find latest price date for this asset, fetch daily from there to fill gap
        const latest = await db.select()
          .from(schema.prices)
          .where(eq(schema.prices.assetId, asset.id))
          .orderBy(desc(schema.prices.date))
          .limit(1);

        let daily = 0;
        if (latest.length > 0) {
          // Fetch daily from 1 day after latest to now
          const gapStart = latest[0].date;
          const today = new Date().toISOString().split('T')[0];
          if (gapStart < today) {
            daily = await fetchHistoricalPrices(asset.id, asset.yahooSymbol, isAud, gapStart, '1d');
          }
        }

        results.push({ symbol: asset.symbol, weekly, daily });
      } catch (error) {
        results.push({ symbol: asset.symbol, weekly: 0, daily: 0 });
        console.error(`Backfill error for ${asset.symbol}:`, error);
      }
    }

    // 3. Also fetch today's live prices
    await fetchCurrentPrices();

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
