import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth-helpers';
import { trackAsync, EVENTS } from '@/lib/analytics';

const SCHEMA_VERSION = 1;

export async function GET() {
  const result = await requireUser();
  if (result instanceof NextResponse) return result;
  const userId = result.id;

  const [userRow] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  const [userSettingsRow] = await db.select().from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId)).limit(1);

  const profiles = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const profileIds = profiles.map(p => p.id);

  const assets = profileIds.length
    ? await db.select().from(schema.assets).where(inArray(schema.assets.profileId, profileIds))
    : [];
  const assetIds = assets.map(a => a.id);

  const transactions = assetIds.length
    ? await db.select().from(schema.transactions).where(inArray(schema.transactions.assetId, assetIds))
    : [];

  const prices = assetIds.length
    ? await db.select().from(schema.prices).where(inArray(schema.prices.assetId, assetIds))
    : [];

  const categoryTargets = profileIds.length
    ? await db.select().from(schema.categoryTargets).where(inArray(schema.categoryTargets.profileId, profileIds))
    : [];

  const cmcAccountMappings = profileIds.length
    ? await db.select().from(schema.cmcAccountMappings).where(inArray(schema.cmcAccountMappings.profileId, profileIds))
    : [];

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    user: userRow ? {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      emailVerified: userRow.emailVerified,
      image: userRow.image,
      createdAt: userRow.createdAt,
    } : null,
    userSettings: userSettingsRow ?? null,
    profiles,
    assets,
    transactions,
    prices,
    categoryTargets,
    cmcAccountMappings,
  };

  trackAsync(EVENTS.ACCOUNT_EXPORTED, { userId, props: { profiles: profiles.length, transactions: transactions.length } });

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `portfolio-export-${userId}-${today}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
