import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { and, eq, inArray } from 'drizzle-orm';
import { requireProfileOwnership, requireUser } from '@/lib/auth-helpers';
import { positiveInt, sanitizedString, optionalString } from '@/lib/validation/primitives';
import { apiError, NotFoundError, parseJsonBody } from '@/lib/api-error';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profiles = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  const profileIds = profiles.map(p => p.id);
  const mappings = profileIds.length === 0
    ? []
    : await db.select().from(schema.cmcAccountMappings).where(inArray(schema.cmcAccountMappings.profileId, profileIds));

  return NextResponse.json({ mappings, profiles });
}

const cmcCreateSchema = z.object({
  accountNumber: sanitizedString(32),
  profileId: positiveInt,
  label: optionalString(64).nullable(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const body = await parseJsonBody(request, cmcCreateSchema);

    const ownership = await requireProfileOwnership(body.profileId, user.id);
    if (ownership instanceof NextResponse) return ownership;

    // Upsert by account number; ensure existing record (if any) is on a profile owned by this user.
    const existing = await db.select({
      id: schema.cmcAccountMappings.id,
      profileId: schema.cmcAccountMappings.profileId,
    }).from(schema.cmcAccountMappings)
      .where(eq(schema.cmcAccountMappings.cmcAccountNumber, body.accountNumber));

    if (existing.length > 0) {
      const ownsExisting = await requireProfileOwnership(existing[0].profileId, user.id);
      if (ownsExisting instanceof NextResponse) return ownsExisting;

      await db.update(schema.cmcAccountMappings)
        .set({ profileId: body.profileId, label: body.label ?? null })
        .where(eq(schema.cmcAccountMappings.id, existing[0].id));
      return NextResponse.json({ success: true, updated: true });
    }

    const result = await db.insert(schema.cmcAccountMappings)
      .values({ cmcAccountNumber: body.accountNumber, profileId: body.profileId, label: body.label ?? null })
      .returning();
    return NextResponse.json({ success: true, id: result[0].id });
  } catch (error) {
    return apiError(error, { route: '/api/settings/cmc-accounts', method: 'POST' });
  }
}

const cmcDeleteSchema = z.object({ id: positiveInt }).strict();

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const body = await parseJsonBody(request, cmcDeleteSchema);

    // Only delete if the mapping points to a profile owned by this user.
    const userProfiles = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id));
    const profileIds = userProfiles.map(p => p.id);
    if (profileIds.length === 0) {
      throw new NotFoundError('Mapping not found');
    }

    const result = await db.delete(schema.cmcAccountMappings)
      .where(and(eq(schema.cmcAccountMappings.id, body.id), inArray(schema.cmcAccountMappings.profileId, profileIds)))
      .returning({ id: schema.cmcAccountMappings.id });
    if (result.length === 0) {
      throw new NotFoundError('Mapping not found');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: '/api/settings/cmc-accounts', method: 'DELETE' });
  }
}
