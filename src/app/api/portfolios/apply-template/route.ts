import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { MODEL_PORTFOLIOS } from '@/lib/model-portfolios';
import { apiError, parseJsonBody } from '@/lib/api-error';
import { trackAsync, EVENTS } from '@/lib/analytics';

const applyTemplateSchema = z.object({
  tier: z.enum(['conservative', 'balanced', 'growth', 'aggressive']),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const { tier } = await parseJsonBody(request, applyTemplateSchema);
    const portfolio = MODEL_PORTFOLIOS[tier];

    // Group the example's ETF allocations by category and sum percentages.
    const categoryTotals = new Map<string, number>();
    for (const etf of portfolio.etfs) {
      categoryTotals.set(etf.category, (categoryTotals.get(etf.category) ?? 0) + etf.allocationPct);
    }

    // Replace this profile's category targets with the example's split, in one transaction.
    await db.transaction(async (tx) => {
      await tx.delete(schema.categoryTargets).where(eq(schema.categoryTargets.profileId, profileId));
      for (const [category, targetPct] of categoryTotals) {
        await tx.insert(schema.categoryTargets).values({
          profileId,
          category,
          targetPct,
          threshold: 5,
        });
      }
    });

    trackAsync(EVENTS.PORTFOLIO_TEMPLATE_APPLIED, { userId: user.id, props: { tier } });

    return NextResponse.json({ ok: true, tier });
  } catch (error) {
    return apiError(error, { route: '/api/portfolios/apply-template', method: 'POST' });
  }
}
