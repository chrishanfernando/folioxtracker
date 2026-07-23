import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { and, eq, inArray } from 'drizzle-orm';
import { requireUser, requireProfileOwnership } from '@/lib/auth-helpers';
import { ensureProfile } from '@/lib/profile';
import { ensureBenchmarkAssetExists, fetchHistoricalPrices } from '@/lib/prices';
import { positiveInt, sanitizedString } from '@/lib/validation/primitives';
import { apiError, NotFoundError, parseJsonBody } from '@/lib/api-error';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  await ensureProfile(user.id);
  const profiles = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  return NextResponse.json(profiles);
}

const profilePatchSchema = z.object({
  id: positiveInt,
  name: sanitizedString(64).optional(),
  benchmarkSymbol: sanitizedString(32).optional(),
  comparisonAdvisorName: sanitizedString(64).optional(),
  comparisonAdvisorFeeBps: z.number().int().min(0).max(500).optional(),
}).strict();

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const body = await parseJsonBody(request, profilePatchSchema);

    const updateSet: Partial<typeof schema.profiles.$inferInsert> = {};
    if (body.name) updateSet.name = body.name;
    if (body.benchmarkSymbol) updateSet.benchmarkSymbol = body.benchmarkSymbol.toUpperCase();
    if (body.comparisonAdvisorName !== undefined) updateSet.comparisonAdvisorName = body.comparisonAdvisorName;
    if (body.comparisonAdvisorFeeBps !== undefined) updateSet.comparisonAdvisorFeeBps = body.comparisonAdvisorFeeBps;

    if (body.benchmarkSymbol) {
      const symbol = body.benchmarkSymbol.toUpperCase();
      const assetId = await ensureBenchmarkAssetExists(symbol);
      // Backfill 2 years of prices for the benchmark to ensure history works.
      // Benchmark assets are pinned to profile id=1 by ensureBenchmarkAssetExists.
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const startDate = twoYearsAgo.toISOString().split('T')[0];
      await fetchHistoricalPrices(
        1,
        { id: assetId, yahooSymbol: symbol, isAud: symbol.endsWith('.AX') },
        startDate,
        '1d',
      );
    }

    const result = await db.update(schema.profiles)
      .set(updateSet)
      .where(and(eq(schema.profiles.id, body.id), eq(schema.profiles.userId, user.id)))
      .returning({ id: schema.profiles.id });

    if (result.length === 0) {
      throw new NotFoundError('Profile not found');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: '/api/profiles', method: 'PATCH' });
  }
}

const profileCreateSchema = z.object({
  name: sanitizedString(64),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const body = await parseJsonBody(request, profileCreateSchema);

    const result = await db.insert(schema.profiles).values({
      name: body.name,
      createdAt: new Date().toISOString().split('T')[0],
      userId: user.id,
    }).returning();
    return NextResponse.json(result[0]);
  } catch (error) {
    return apiError(error, { route: '/api/profiles', method: 'POST' });
  }
}

const profileDeleteSchema = z.object({ id: positiveInt }).strict();

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const { id } = await parseJsonBody(request, profileDeleteSchema);

    // 404 (not 403) when the profile isn't the caller's, matching the codebase's
    // non-leaking ownership pattern.
    const owned = await requireProfileOwnership(id, user.id);
    if (owned instanceof NextResponse) return owned;

    // A user must always keep at least one profile — the app resolves an active
    // profile on every request and would otherwise just lazily recreate one.
    const remaining = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id));
    if (remaining.length <= 1) {
      return NextResponse.json({ error: "You can't delete your only profile." }, { status: 400 });
    }

    // Cascade the profile's data manually (same tables/order as the user-delete
    // hook — the ALTER-TABLE-added FKs don't carry ON DELETE CASCADE). Wrapped in
    // a transaction so a partial delete can't leave orphaned rows.
    await db.transaction(async (tx) => {
      const assetRows = await tx.select({ id: schema.assets.id })
        .from(schema.assets)
        .where(eq(schema.assets.profileId, id));
      const assetIds = assetRows.map(a => a.id);
      if (assetIds.length > 0) {
        await tx.delete(schema.prices).where(inArray(schema.prices.assetId, assetIds));
        await tx.delete(schema.transactions).where(inArray(schema.transactions.assetId, assetIds));
        await tx.delete(schema.assets).where(inArray(schema.assets.id, assetIds));
      }
      await tx.delete(schema.categoryTargets).where(eq(schema.categoryTargets.profileId, id));
      await tx.delete(schema.cmcAccountMappings).where(eq(schema.cmcAccountMappings.profileId, id));
      await tx.delete(schema.profiles).where(eq(schema.profiles.id, id));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: '/api/profiles', method: 'DELETE' });
  }
}
