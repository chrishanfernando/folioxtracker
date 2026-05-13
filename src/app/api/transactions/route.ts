import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { requireAssetOwnership, requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';

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

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await request.json();
  const { assetId, date, action, quantity, unitPriceLocal, localCurrency, fxRate, unitPriceAud, splitMultiplier, comment } = body;

  const ownership = await requireAssetOwnership(assetId, user.id);
  if (ownership instanceof NextResponse) return ownership;

  const adjustedQty = quantity * (splitMultiplier || 1);
  const totalAud = Math.abs(unitPriceAud * quantity);

  const result = await db.insert(schema.transactions).values({
    assetId,
    date,
    action,
    quantity,
    unitPriceLocal,
    localCurrency,
    fxRate,
    unitPriceAud,
    splitMultiplier: splitMultiplier || 1,
    adjustedQty,
    totalAud,
    comment,
  }).returning();

  return NextResponse.json(result[0]);
}
