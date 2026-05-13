import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';

async function createDefaultProfile(userId: string): Promise<number> {
  const u = await db.select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const name = u[0]?.name?.trim() || 'My Portfolio';
  const created = await db.insert(schema.profiles).values({
    name,
    createdAt: new Date().toISOString().split('T')[0],
    userId,
  }).returning({ id: schema.profiles.id });
  return created[0].id;
}

export async function ensureProfile(userId: string): Promise<number> {
  const first = await db.select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .orderBy(schema.profiles.id)
    .limit(1);
  if (first.length > 0) return first[0].id;
  return createDefaultProfile(userId);
}

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
 * - Otherwise return the user's first profile, lazily creating a "Default" profile
 *   if the user has none yet (new signups don't get one auto-created at signup time).
 * - Returns a 404 NextResponse only when an explicitly requested profile doesn't belong
 *   to the user.
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
    if (owned.length > 0) return requested;
    // Requested profile isn't ours. If we have any profile, refuse with 404. If
    // we have none, fall through and auto-create — the client sends a stale
    // default id=1 before it has loaded the real profile list.
    const anyOwned = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);
    if (anyOwned.length > 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
  } else {
    const first = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .orderBy(schema.profiles.id)
      .limit(1);
    if (first.length > 0) return first[0].id;
  }

  return createDefaultProfile(userId);
}
