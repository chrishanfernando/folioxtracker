import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentPrices } from '@/lib/prices';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { checkCooldown, PRICE_FETCH_COOLDOWN_MS } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const cooldown = checkCooldown('price-fetch', user.id, PRICE_FETCH_COOLDOWN_MS);
    if (!cooldown.allowed) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      res.headers.set('retry-after', Math.ceil(cooldown.retryAfterMs / 1000).toString());
      return res;
    }

    const resolved = await resolveProfileId(request, user.id);
    if (resolved instanceof NextResponse) return resolved;

    const results = await fetchCurrentPrices(resolved);
    return NextResponse.json({ success: true, prices: results });
  } catch (error) {
    return apiError(error, { route: '/api/prices/fetch', method: 'POST' });
  }
}
