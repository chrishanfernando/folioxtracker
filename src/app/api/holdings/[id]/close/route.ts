import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, asc } from 'drizzle-orm';
import { requireAssetOwnership, requireUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const assetId = parseInt(id);

  const ownership = await requireAssetOwnership(assetId, user.id);
  if (ownership instanceof NextResponse) return ownership;

  const { priceAud, date } = await request.json();

  const asset = await db.select().from(schema.assets).where(eq(schema.assets.id, assetId));
  if (asset.length === 0) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Calculate remaining quantity
  const transactions = await db.select()
    .from(schema.transactions)
    .where(eq(schema.transactions.assetId, assetId))
    .orderBy(asc(schema.transactions.date));

  let totalQty = 0;
  let totalCost = 0;
  for (const tx of transactions) {
    if (tx.action === 'BUY') {
      totalCost += Math.abs(tx.totalAud);
      totalQty += tx.adjustedQty;
    } else if (tx.action === 'SELL') {
      const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
      totalCost -= avgCost * Math.abs(tx.adjustedQty);
      totalQty -= Math.abs(tx.adjustedQty);
    }
  }

  if (totalQty <= 0.0001) {
    return NextResponse.json({ error: 'No units to sell' }, { status: 400 });
  }

  const sellDate = date || new Date().toISOString().split('T')[0];
  const sellPrice = priceAud;
  const totalAud = totalQty * sellPrice;

  // Create the closing SELL transaction
  await db.insert(schema.transactions).values({
    assetId,
    date: sellDate,
    action: 'SELL',
    quantity: totalQty,
    unitPriceLocal: null,
    localCurrency: null,
    fxRate: null,
    unitPriceAud: sellPrice,
    splitMultiplier: 1,
    adjustedQty: totalQty,
    totalAud,
    comment: 'Position closed',
  });

  // Mark asset as inactive (won't show in current holdings, still in history)
  await db.update(schema.assets)
    .set({ isActive: false })
    .where(eq(schema.assets.id, assetId));

  const profitLoss = totalAud - totalCost;

  return NextResponse.json({
    success: true,
    quantity: totalQty,
    sellPrice,
    totalAud,
    profitLoss,
  });
}
