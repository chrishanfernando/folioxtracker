import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { eq, asc } from 'drizzle-orm';
import { requireAssetOwnership, requireUser } from '@/lib/auth-helpers';
import { aud, isoDate, positiveInt } from '@/lib/validation/primitives';
import { apiError, NotFoundError, ValidationError, parseJsonBody } from '@/lib/api-error';

const paramsSchema = z.object({ id: positiveInt });

const closeSchema = z.object({
  priceAud: aud,
  date: isoDate.optional(),
}).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const { id: assetId } = paramsSchema.parse(await params);

    const ownership = await requireAssetOwnership(assetId, user.id);
    if (ownership instanceof NextResponse) return ownership;

    const body = await parseJsonBody(request, closeSchema);

    const asset = await db.select().from(schema.assets).where(eq(schema.assets.id, assetId));
    if (asset.length === 0) {
      throw new NotFoundError('Asset not found');
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
      throw new ValidationError([{ path: 'quantity', message: 'No units to sell' }]);
    }

    const sellDate = body.date || new Date().toISOString().split('T')[0];
    const sellPrice = body.priceAud;
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
  } catch (error) {
    return apiError(error, { route: '/api/holdings/[id]/close', method: 'POST' });
  }
}
