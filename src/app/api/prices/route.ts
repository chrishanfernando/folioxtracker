import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  const assets = await db.select()
    .from(schema.assets)
    .where(and(eq(schema.assets.isActive, true), eq(schema.assets.profileId, profileId)));

  if (assets.length === 0) return NextResponse.json({});

  const assetIds = assets.map(a => a.id);
  const allPrices = await db.select()
    .from(schema.prices)
    .where(inArray(schema.prices.assetId, assetIds))
    .orderBy(desc(schema.prices.date));

  // Pick the latest price per asset (first row per assetId given desc date order).
  const latestPrices: Record<number, { date: string; priceAud: number }> = {};
  for (const p of allPrices) {
    if (!latestPrices[p.assetId]) {
      latestPrices[p.assetId] = { date: p.date, priceAud: p.priceAud };
    }
  }

  return NextResponse.json(latestPrices);
}
