import { NextRequest, NextResponse } from 'next/server';
import { calculateHoldings, calculateClosedHoldings } from '@/lib/calculations';
import { getProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  try {
    const profileId = getProfileId(request);
    const [holdings, closed] = await Promise.all([
      calculateHoldings(profileId),
      calculateClosedHoldings(profileId),
    ]);
    return NextResponse.json({ holdings, closed });
  } catch (error) {
    console.error('Holdings error:', error);
    return NextResponse.json({ error: 'Failed to load holdings' }, { status: 500 });
  }
}
