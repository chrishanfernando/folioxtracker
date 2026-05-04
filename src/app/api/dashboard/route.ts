import { NextRequest, NextResponse } from 'next/server';
import { calculatePortfolioSummary, getPortfolioValueHistory } from '@/lib/calculations';
import { getProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  try {
    const profileId = getProfileId(request);
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
