import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { calculateDrift, calculateBuyRecommendations } from '@/lib/rebalance';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  const drift = await calculateDrift(profileId);
  return NextResponse.json(drift);
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  const { targets, investAmount } = await request.json();

  if (targets) {
    for (const target of targets) {
      const existing = await db.select().from(schema.categoryTargets)
        .where(and(
          eq(schema.categoryTargets.category, target.category),
          eq(schema.categoryTargets.profileId, profileId),
        ));

      if (existing.length > 0) {
        await db.update(schema.categoryTargets)
          .set({ targetPct: target.targetPct, threshold: target.threshold || 5 })
          .where(eq(schema.categoryTargets.id, existing[0].id));
      } else {
        await db.insert(schema.categoryTargets).values({
          profileId,
          category: target.category,
          targetPct: target.targetPct,
          threshold: target.threshold || 5,
        });
      }
    }
    const drift = await calculateDrift(profileId);
    return NextResponse.json(drift);
  }

  if (investAmount) {
    const result = await calculateBuyRecommendations(investAmount, profileId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
