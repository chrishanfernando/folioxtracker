import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireAssetOwnership, requireUser } from '@/lib/auth-helpers';
import { positiveInt, sanitizedString } from '@/lib/validation/primitives';
import { apiError, ValidationError, parseJsonBody } from '@/lib/api-error';

const paramsSchema = z.object({ id: positiveInt });

const assetPatchSchema = z.object({
  platform: sanitizedString(64).optional(),
  category: sanitizedString(64).optional(),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const { id: assetId } = paramsSchema.parse(await params);

    const ownership = await requireAssetOwnership(assetId, user.id);
    if (ownership instanceof NextResponse) return ownership;

    const body = await parseJsonBody(request, assetPatchSchema);

    const updates: Record<string, unknown> = {};
    if (body.platform !== undefined) updates.platform = body.platform;
    if (body.category !== undefined) updates.category = body.category;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError([{ path: '(root)', message: 'Nothing to update' }]);
    }

    await db.update(schema.assets).set(updates).where(eq(schema.assets.id, assetId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: '/api/assets/[id]', method: 'PATCH' });
  }
}
