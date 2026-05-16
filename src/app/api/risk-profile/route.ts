import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { calcScore, scoreToTier, TIER_PROFILES } from '@/lib/risk-profiling';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  const rows = await db
    .select()
    .from(schema.riskProfiles)
    .where(and(eq(schema.riskProfiles.userId, user.id), eq(schema.riskProfiles.profileId, profileId)))
    .limit(1);

  if (rows.length === 0) return NextResponse.json(null);

  const row = rows[0];
  return NextResponse.json({
    riskTier: row.riskTier,
    riskScore: row.riskScore,
    answers: JSON.parse(row.answers) as number[],
    updatedAt: row.updatedAt,
  });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profileId = await resolveProfileId(request, user.id);
  if (profileId instanceof NextResponse) return profileId;

  const body = await request.json() as { answers: number[]; applyTargets?: boolean };
  const { answers, applyTargets } = body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'answers required' }, { status: 400 });
  }

  const riskScore = calcScore(answers);
  const riskTier = scoreToTier(riskScore);
  const now = new Date().toISOString();

  const existing = await db
    .select({ id: schema.riskProfiles.id })
    .from(schema.riskProfiles)
    .where(and(eq(schema.riskProfiles.userId, user.id), eq(schema.riskProfiles.profileId, profileId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.riskProfiles)
      .set({ riskScore, riskTier, answers: JSON.stringify(answers), updatedAt: now })
      .where(eq(schema.riskProfiles.id, existing[0].id));
  } else {
    await db.insert(schema.riskProfiles).values({
      userId: user.id,
      profileId,
      riskScore,
      riskTier,
      answers: JSON.stringify(answers),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (applyTargets) {
    const tierProfile = TIER_PROFILES[riskTier];

    // Group ETF allocations by category and sum percentages
    const categoryTotals = new Map<string, number>();
    for (const etf of tierProfile.etfs) {
      categoryTotals.set(etf.category, (categoryTotals.get(etf.category) ?? 0) + etf.allocationPct);
    }

    // Delete existing targets for this profile
    await db.delete(schema.categoryTargets).where(eq(schema.categoryTargets.profileId, profileId));

    // Insert new targets
    for (const [category, targetPct] of categoryTotals) {
      await db.insert(schema.categoryTargets).values({
        profileId,
        category,
        targetPct,
        threshold: 5,
      });
    }
  }

  return NextResponse.json({ riskTier, riskScore, tier: TIER_PROFILES[riskTier] });
}
