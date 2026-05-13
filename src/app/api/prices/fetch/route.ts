import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentPrices } from '@/lib/prices';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth-helpers';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const force = request.nextUrl.searchParams.get('force') === 'true';

    if (!force) {
      const settings = await db.select().from(schema.settings).limit(1);
      const lastFetch = settings[0]?.lastPriceFetch;
      if (lastFetch) {
        const elapsed = Date.now() - new Date(lastFetch).getTime();
        if (elapsed < COOLDOWN_MS) {
          return NextResponse.json({ success: true, skipped: true, message: 'Prices fetched recently' });
        }
      }
    }

    const results = await fetchCurrentPrices();
    return NextResponse.json({ success: true, prices: results });
  } catch (error) {
    console.error('Price fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}
