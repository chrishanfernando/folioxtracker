import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { requireAssetOwnership, requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { aud, isoDate, optionalString, qtyDecimal, transactionAction, assetIdRef } from '@/lib/validation/primitives';
import { apiError, parseJsonBody } from '@/lib/api-error';
import { trackAsync, EVENTS } from '@/lib/analytics';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  // Get asset IDs for this profile
  const profileAssets = await db.select({ id: schema.assets.id })
    .from(schema.assets)
    .where(eq(schema.assets.profileId, profileId));
  const assetIds = profileAssets.map(a => a.id);

  if (assetIds.length === 0) {
    return NextResponse.json([]);
  }

  const transactions = await db.select({
    id: schema.transactions.id,
    assetId: schema.transactions.assetId,
    date: schema.transactions.date,
    action: schema.transactions.action,
    quantity: schema.transactions.quantity,
    unitPriceLocal: schema.transactions.unitPriceLocal,
    localCurrency: schema.transactions.localCurrency,
    fxRate: schema.transactions.fxRate,
    unitPriceAud: schema.transactions.unitPriceAud,
    splitMultiplier: schema.transactions.splitMultiplier,
    adjustedQty: schema.transactions.adjustedQty,
    totalAud: schema.transactions.totalAud,
    comment: schema.transactions.comment,
    symbol: schema.assets.symbol,
    displayTicker: schema.assets.displayTicker,
    assetName: schema.assets.name,
  })
    .from(schema.transactions)
    .leftJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
    .where(inArray(schema.transactions.assetId, assetIds))
    .orderBy(desc(schema.transactions.date));

  return NextResponse.json(transactions);
}

const transactionCreateSchema = z.object({
  assetId: assetIdRef,
  date: isoDate,
  action: transactionAction,
  quantity: qtyDecimal,
  unitPriceLocal: aud.nullable().optional(),
  localCurrency: optionalString(8).nullable(),
  fxRate: z.number().positive().finite().nullable().optional(),
  unitPriceAud: aud,
  splitMultiplier: z.number().positive().finite().optional(),
  comment: optionalString(1000).nullable(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const body = await parseJsonBody(request, transactionCreateSchema);

    const ownership = await requireAssetOwnership(body.assetId, user.id);
    if (ownership instanceof NextResponse) return ownership;

    const splitMultiplier = body.splitMultiplier ?? 1;
    const adjustedQty = body.quantity * splitMultiplier;
    const totalAud = Math.abs(body.unitPriceAud * body.quantity);

    const result = await db.insert(schema.transactions).values({
      assetId: body.assetId,
      date: body.date,
      action: body.action,
      quantity: body.quantity,
      unitPriceLocal: body.unitPriceLocal ?? null,
      localCurrency: body.localCurrency ?? null,
      fxRate: body.fxRate ?? null,
      unitPriceAud: body.unitPriceAud,
      splitMultiplier,
      adjustedQty,
      totalAud,
      comment: body.comment ?? null,
    }).returning();

    trackAsync(EVENTS.TRANSACTION_CREATED, { userId: user.id, props: { source: 'manual', action: body.action } });

    return NextResponse.json(result[0]);
  } catch (error) {
    return apiError(error, { route: '/api/transactions', method: 'POST' });
  }
}
