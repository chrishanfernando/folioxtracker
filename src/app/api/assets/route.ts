import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { sanitizedString, optionalString } from '@/lib/validation/primitives';
import { apiError, parseJsonBody } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  const assets = await db.select()
    .from(schema.assets)
    .where(eq(schema.assets.profileId, profileId));

  return NextResponse.json(assets);
}

const assetCreateSchema = z.object({
  symbol: sanitizedString(32),
  name: sanitizedString(128),
  displayTicker: sanitizedString(32),
  yahooSymbol: sanitizedString(32),
  category: sanitizedString(64),
  platform: optionalString(64).nullable(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const body = await parseJsonBody(request, assetCreateSchema);

    // Check if asset already exists for this profile
    const existing = await db.select()
      .from(schema.assets)
      .where(and(
        eq(schema.assets.profileId, profileId),
        eq(schema.assets.yahooSymbol, body.yahooSymbol)
      ))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(existing[0]);
    }

    const result = await db.insert(schema.assets).values({
      profileId,
      symbol: body.symbol.toUpperCase(),
      name: body.name,
      displayTicker: body.displayTicker.toUpperCase(),
      yahooSymbol: body.yahooSymbol,
      category: body.category,
      platform: body.platform ?? null,
      isActive: true,
    }).returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    return apiError(error, { route: '/api/assets', method: 'POST' });
  }
}
