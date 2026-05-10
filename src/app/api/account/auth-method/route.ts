import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth-helpers';

export async function GET() {
  const result = await requireUser();
  if (result instanceof NextResponse) return result;
  const userId = result.id;

  const rows = await db.select({ id: schema.account.id })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'credential')))
    .limit(1);

  return NextResponse.json({ hasPassword: rows.length > 0 });
}
