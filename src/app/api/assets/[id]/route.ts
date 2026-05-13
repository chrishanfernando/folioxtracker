import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireAssetOwnership, requireUser } from '@/lib/auth-helpers';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const assetId = parseInt(id);

  const ownership = await requireAssetOwnership(assetId, user.id);
  if (ownership instanceof NextResponse) return ownership;

  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.platform !== undefined) updates.platform = body.platform;
  if (body.category !== undefined) updates.category = body.category;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  await db.update(schema.assets).set(updates).where(eq(schema.assets.id, assetId));

  return NextResponse.json({ success: true });
}
