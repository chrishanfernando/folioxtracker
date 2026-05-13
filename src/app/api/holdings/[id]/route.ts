import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, asc, desc, inArray } from 'drizzle-orm';
import { requireAssetOwnership, requireUser } from '@/lib/auth-helpers';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const assetId = parseInt(id);

  const ownership = await requireAssetOwnership(assetId, user.id);
  if (ownership instanceof NextResponse) return ownership;

  const asset = await db.select().from(schema.assets).where(eq(schema.assets.id, assetId));
  if (asset.length === 0) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const transactions = await db.select()
    .from(schema.transactions)
    .where(eq(schema.transactions.assetId, assetId))
    .orderBy(desc(schema.transactions.date));

  // Get prices - merge from this asset and all sibling assets with the same yahooSymbol
  const siblings = await db.select({ id: schema.assets.id })
    .from(schema.assets)
    .where(eq(schema.assets.yahooSymbol, asset[0].yahooSymbol));
  const allRelatedIds = siblings.map(s => s.id);

  const allPrices = await db.select()
    .from(schema.prices)
    .where(inArray(schema.prices.assetId, allRelatedIds))
    .orderBy(asc(schema.prices.date));

  // Deduplicate by date (keep latest per date)
  const byDate = new Map<string, typeof allPrices[0]>();
  for (const p of allPrices) byDate.set(p.date, p);
  let priceHistory = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Calculate holdings for this asset
  let totalQty = 0;
  let totalCost = 0;
  for (const tx of [...transactions].reverse()) {
    if (tx.action === 'BUY') {
      totalCost += Math.abs(tx.totalAud);
      totalQty += tx.adjustedQty;
    } else if (tx.action === 'SELL') {
      const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
      totalCost -= avgCost * Math.abs(tx.adjustedQty);
      totalQty -= Math.abs(tx.adjustedQty);
    }
  }

  const latestPrice = priceHistory[priceHistory.length - 1]?.priceAud || 0;
  const marketValue = totalQty * latestPrice;

  // Extend price history to today if last entry is older
  const today = new Date().toISOString().split('T')[0];
  const lastPriceDate = priceHistory[priceHistory.length - 1]?.date;
  if (lastPriceDate && lastPriceDate < today && latestPrice > 0) {
    priceHistory.push({ id: 0, assetId, date: today, priceAud: latestPrice, priceUsd: null, fxRate: null });
  }

  return NextResponse.json({
    asset: asset[0],
    transactions,
    priceHistory,
    holding: {
      quantity: totalQty,
      avgCost: totalQty > 0 ? totalCost / totalQty : 0,
      totalCost,
      currentPrice: latestPrice,
      marketValue,
      profitLoss: marketValue - totalCost,
      profitLossPct: totalCost > 0 ? ((marketValue - totalCost) / totalCost) * 100 : 0,
    },
  });
}
