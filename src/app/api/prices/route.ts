import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const assets = await db.select().from(schema.assets).where(eq(schema.assets.isActive, true));
  const latestPrices: Record<number, { date: string; priceAud: number }> = {};

  for (const asset of assets) {
    const price = await db.select()
      .from(schema.prices)
      .where(eq(schema.prices.assetId, asset.id))
      .orderBy(desc(schema.prices.date))
      .limit(1);

    if (price[0]) {
      latestPrices[asset.id] = { date: price[0].date, priceAud: price[0].priceAud };
    }
  }

  return NextResponse.json(latestPrices);
}
