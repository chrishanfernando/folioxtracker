import { NextResponse } from 'next/server';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth-helpers';

export async function GET() {
  const result = await requireUser();
  if (result instanceof NextResponse) return result;
  const userId = result.id;

  const profileRows = await db.select({ id: schema.profiles.id })
    .from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const profileIds = profileRows.map(p => p.id);

  let assetCount = 0;
  let transactionCount = 0;

  if (profileIds.length > 0) {
    const [{ count: assets }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.assets)
      .where(inArray(schema.assets.profileId, profileIds));
    assetCount = Number(assets);

    const assetRows = await db.select({ id: schema.assets.id })
      .from(schema.assets).where(inArray(schema.assets.profileId, profileIds));
    const assetIds = assetRows.map(a => a.id);

    if (assetIds.length > 0) {
      const [{ count: txs }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.transactions)
        .where(inArray(schema.transactions.assetId, assetIds));
      transactionCount = Number(txs);
    }
  }

  return NextResponse.json({
    profiles: profileIds.length,
    assets: assetCount,
    transactions: transactionCount,
  });
}
