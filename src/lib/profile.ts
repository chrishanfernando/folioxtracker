import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/** Extract profileId from request header or query param. */
export function getRequestedProfileId(request: NextRequest): number | null {
  const fromHeader = request.headers.get('x-profile-id');
  if (fromHeader) {
    const n = parseInt(fromHeader);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const fromQuery = request.nextUrl.searchParams.get('profileId');
  if (fromQuery) {
    const n = parseInt(fromQuery);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

/**
 * Resolve the active profile for a request, scoped to the authenticated user.
 * - If the client supplied a profileId via header/query, validate it belongs to the user.
 * - Otherwise return the user's first profile.
 * - Returns a 404 NextResponse when the requested profile doesn't belong to the user
 *   and a 404 if the user has no profiles yet.
 */
export async function resolveProfileId(
  request: NextRequest,
  userId: string,
): Promise<number | NextResponse> {
  const requested = getRequestedProfileId(request);

  if (requested !== null) {
    const owned = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(and(eq(schema.profiles.id, requested), eq(schema.profiles.userId, userId)))
      .limit(1);
    if (owned.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return requested;
  }

  const first = await db.select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .orderBy(schema.profiles.id)
    .limit(1);

  if (first.length === 0) {
    return NextResponse.json({ error: 'No profiles' }, { status: 404 });
  }
  return first[0].id;
}
