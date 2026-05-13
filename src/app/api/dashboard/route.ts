import { NextRequest, NextResponse } from 'next/server';
import { calculatePortfolioSummary, getPortfolioValueHistory } from '@/lib/calculations';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const [summary, history] = await Promise.all([
      calculatePortfolioSummary(profileId),
      getPortfolioValueHistory(profileId),
    ]);

    return NextResponse.json({ summary, history });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
