import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { asc, inArray } from 'drizzle-orm';
import { calculateHoldings } from '@/lib/calculations';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const holdings = await calculateHoldings(profileId);

    // Sort by market value descending
    holdings.sort((a, b) => b.marketValueAud - a.marketValueAud);

    // For each holding, fetch price history using sibling asset lookup (same yahooSymbol)
    const allAssets = await db.select({ id: schema.assets.id, yahooSymbol: schema.assets.yahooSymbol })
      .from(schema.assets);

    const yahooToIds = new Map<string, number[]>();
    for (const asset of allAssets) {
      const ids = yahooToIds.get(asset.yahooSymbol) || [];
      ids.push(asset.id);
      yahooToIds.set(asset.yahooSymbol, ids);
    }

    // Collect all sibling asset IDs we'll need prices for
    const allNeededIds = new Set<number>();
    for (const holding of holdings) {
      const assetRow = allAssets.find(a => a.id === holding.assetId);
      if (!assetRow) continue;
      const siblings = yahooToIds.get(assetRow.yahooSymbol) || [holding.assetId];
      for (const id of siblings) allNeededIds.add(id);
    }

    // Bulk-fetch all needed prices in one query
    const allPrices = allNeededIds.size > 0
      ? await db.select()
          .from(schema.prices)
          .where(inArray(schema.prices.assetId, Array.from(allNeededIds)))
          .orderBy(asc(schema.prices.date))
      : [];

    // Group prices by assetId for fast lookup
    const pricesByAssetId = new Map<number, typeof allPrices>();
    for (const p of allPrices) {
      const list = pricesByAssetId.get(p.assetId) || [];
      list.push(p);
      pricesByAssetId.set(p.assetId, list);
    }

    const today = new Date().toISOString().split('T')[0];

    const result = holdings.map(holding => {
      const assetRow = allAssets.find(a => a.id === holding.assetId);
      const yahooSymbol = assetRow?.yahooSymbol ?? '';
      const siblingIds = yahooToIds.get(yahooSymbol) || [holding.assetId];

      // Merge prices from all siblings, deduplicate by date (last-write-wins)
      const byDate = new Map<string, number>();
      for (const siblingId of siblingIds) {
        const prices = pricesByAssetId.get(siblingId) || [];
        for (const p of prices) byDate.set(p.date, p.priceAud);
      }

      let priceHistory = Array.from(byDate.entries())
        .map(([date, priceAud]) => ({ date, priceAud }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Extend to today if the latest price is older
      const lastEntry = priceHistory[priceHistory.length - 1];
      if (lastEntry && lastEntry.date < today && lastEntry.priceAud > 0) {
        priceHistory.push({ date: today, priceAud: lastEntry.priceAud });
      }

      return {
        assetId: holding.assetId,
        displayTicker: holding.displayTicker,
        name: holding.name,
        priceHistory,
        profitLossPct: holding.profitLossPct,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Holdings charts error:', error);
    return NextResponse.json({ error: 'Failed to load holdings chart data' }, { status: 500 });
  }
}
