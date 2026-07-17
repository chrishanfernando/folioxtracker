import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@/db';
import { env } from '@/lib/env';

export type SessionUser = { id: string; email: string; name: string };

/**
 * Read the active session. Returns the user or null if unauthenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

/**
 * Require an authenticated session. Returns either the user or a 401 Response.
 * Use in API route handlers:
 *
 *   const result = await requireUser();
 *   if (result instanceof NextResponse) return result;
 *   const userId = result.id;
 */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

/**
 * Whether the given email is allowed to access the internal admin surfaces.
 * Gated by the ADMIN_EMAILS env var; empty list denies everyone.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return env.ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Require an authenticated *admin* session. Returns the user or null. Intended
 * for server components that render internal tooling (call `notFound()` on null
 * so the route's existence isn't leaked to non-admins).
 */
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

/**
 * Verify the given profile belongs to the user. Returns 404 if not — we don't
 * leak existence of profiles owned by other users via 403.
 */
export async function requireProfileOwnership(
  profileId: number,
  userId: string,
): Promise<true | NextResponse> {
  const rows = await db.select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(eq(schema.profiles.id, profileId), eq(schema.profiles.userId, userId)))
    .limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  return true;
}

/**
 * Verify the given asset's profile belongs to the user. Returns 404 if not.
 */
export async function requireAssetOwnership(
  assetId: number,
  userId: string,
): Promise<true | NextResponse> {
  const rows = await db.select({ id: schema.assets.id })
    .from(schema.assets)
    .innerJoin(schema.profiles, eq(schema.assets.profileId, schema.profiles.id))
    .where(and(eq(schema.assets.id, assetId), eq(schema.profiles.userId, userId)))
    .limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
  return true;
}

/**
 * Verify the given transaction is on an asset under a profile owned by the user.
 */
export async function requireTransactionOwnership(
  txId: number,
  userId: string,
): Promise<true | NextResponse> {
  const rows = await db.select({ id: schema.transactions.id })
    .from(schema.transactions)
    .innerJoin(schema.assets, eq(schema.transactions.assetId, schema.assets.id))
    .innerJoin(schema.profiles, eq(schema.assets.profileId, schema.profiles.id))
    .where(and(eq(schema.transactions.id, txId), eq(schema.profiles.userId, userId)))
    .limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }
  return true;
}
