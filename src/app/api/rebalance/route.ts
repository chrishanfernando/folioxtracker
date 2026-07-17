import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { calculateDrift, calculateBuyRecommendations } from '@/lib/rebalance';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { aud, sanitizedString } from '@/lib/validation/primitives';
import { apiError, ValidationError, parseJsonBody } from '@/lib/api-error';
import { trackAsync, EVENTS } from '@/lib/analytics';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  const drift = await calculateDrift(profileId);
  trackAsync(EVENTS.REBALANCE_VIEWED, { userId: user.id });
  return NextResponse.json(drift);
}

const targetSchema = z.object({
  category: sanitizedString(64),
  targetPct: z.number().min(0).max(100).finite(),
  threshold: z.number().min(0).max(100).finite().optional(),
});

const rebalancePostSchema = z.object({
  targets: z.array(targetSchema).optional(),
  investAmount: aud.optional(),
}).strict().refine(b => b.targets || b.investAmount !== undefined, {
  message: 'Either `targets` or `investAmount` is required',
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const body = await parseJsonBody(request, rebalancePostSchema);

    if (body.targets) {
      for (const target of body.targets) {
        const existing = await db.select().from(schema.categoryTargets)
          .where(and(
            eq(schema.categoryTargets.category, target.category),
            eq(schema.categoryTargets.profileId, profileId),
          ));

        if (existing.length > 0) {
          await db.update(schema.categoryTargets)
            .set({ targetPct: target.targetPct, threshold: target.threshold ?? 5 })
            .where(eq(schema.categoryTargets.id, existing[0].id));
        } else {
          await db.insert(schema.categoryTargets).values({
            profileId,
            category: target.category,
            targetPct: target.targetPct,
            threshold: target.threshold ?? 5,
          });
        }
      }
      const drift = await calculateDrift(profileId);
      trackAsync(EVENTS.TARGET_SET, { userId: user.id, props: { count: body.targets.length } });
      return NextResponse.json(drift);
    }

    if (body.investAmount !== undefined) {
      const result = await calculateBuyRecommendations(body.investAmount, profileId);
      return NextResponse.json(result);
    }

    throw new ValidationError([{ path: '(root)', message: 'Invalid request' }]);
  } catch (error) {
    return apiError(error, { route: '/api/rebalance', method: 'POST' });
  }
}
