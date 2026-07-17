import { NextRequest, NextResponse } from 'next/server';
import { calculatePortfolioSummary, getPortfolioValueHistory, getBenchmarkValueHistory } from '@/lib/calculations';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { trackAsync, valueBucket, EVENTS } from '@/lib/analytics';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const [summary, history, benchmark] = await Promise.all([
      calculatePortfolioSummary(profileId),
      getPortfolioValueHistory(profileId),
      getBenchmarkValueHistory(profileId),
    ]);

    // Merge benchmark history into main history
    const mergedHistory = history.map(h => {
      // Find closest benchmark value on or before this date
      const bh = benchmark.history.filter(b => b.date <= h.date).pop();
      return { ...h, benchmarkValue: bh?.value };
    });

    trackAsync(EVENTS.DASHBOARD_VIEWED, { userId: user.id, props: { valueBucket: valueBucket(summary.totalValue) } });

    return NextResponse.json({ summary, history: mergedHistory });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
