import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { and, eq, inArray } from 'drizzle-orm';
import { requireProfileOwnership, requireUser } from '@/lib/auth-helpers';

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

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { accountNumber, profileId, label } = await request.json();
  if (!accountNumber || !profileId) {
    return NextResponse.json({ error: 'Account number and profile are required' }, { status: 400 });
  }

  const ownership = await requireProfileOwnership(profileId, user.id);
  if (ownership instanceof NextResponse) return ownership;

  // Upsert by account number; ensure existing record (if any) is on a profile owned by this user.
  const existing = await db.select({
    id: schema.cmcAccountMappings.id,
    profileId: schema.cmcAccountMappings.profileId,
  }).from(schema.cmcAccountMappings)
    .where(eq(schema.cmcAccountMappings.cmcAccountNumber, accountNumber));

  if (existing.length > 0) {
    const ownsExisting = await requireProfileOwnership(existing[0].profileId, user.id);
    if (ownsExisting instanceof NextResponse) return ownsExisting;

    await db.update(schema.cmcAccountMappings)
      .set({ profileId, label: label || null })
      .where(eq(schema.cmcAccountMappings.id, existing[0].id));
    return NextResponse.json({ success: true, updated: true });
  }

  const result = await db.insert(schema.cmcAccountMappings)
    .values({ cmcAccountNumber: accountNumber, profileId, label: label || null })
    .returning();
  return NextResponse.json({ success: true, id: result[0].id });
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // Only delete if the mapping points to a profile owned by this user.
  const userProfiles = await db.select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id));
  const profileIds = userProfiles.map(p => p.id);
  if (profileIds.length === 0) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
  }

  const result = await db.delete(schema.cmcAccountMappings)
    .where(and(eq(schema.cmcAccountMappings.id, id), inArray(schema.cmcAccountMappings.profileId, profileIds)))
    .returning({ id: schema.cmcAccountMappings.id });
  if (result.length === 0) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
