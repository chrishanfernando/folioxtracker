import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
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
}).strict();

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const body = await parseJsonBody(request, profilePatchSchema);

    const updateSet: Partial<typeof schema.profiles.$inferInsert> = {};
    if (body.name) updateSet.name = body.name;
    if (body.benchmarkSymbol) updateSet.benchmarkSymbol = body.benchmarkSymbol.toUpperCase();

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
