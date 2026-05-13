import { NextRequest, NextResponse } from 'next/server';
import { calculateHoldings, calculateClosedHoldings } from '@/lib/calculations';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

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
