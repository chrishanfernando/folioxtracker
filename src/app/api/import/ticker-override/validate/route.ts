import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { sanitizedString } from '@/lib/validation/primitives';
import { apiError, parseJsonBody, AppError } from '@/lib/api-error';
import { fetchLivePriceAud } from '@/lib/prices';

const validateSchema = z.object({
  yahooSymbol: sanitizedString(32),
}).strict();

// Confirms a user-supplied Yahoo symbol resolves to a live quote before an
// override that uses it is saved. fetchLivePriceAud returns 0 when the symbol
// cannot be priced, which we treat as unverifiable.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const { yahooSymbol } = await parseJsonBody(request, validateSchema);

    const priceAud = await fetchLivePriceAud(yahooSymbol);
    if (!(priceAud > 0)) {
      throw new AppError(400, `Could not verify Yahoo symbol "${yahooSymbol}" — no live quote found`);
    }

    return NextResponse.json({ ok: true, yahooSymbol, priceAud });
  } catch (error) {
    return apiError(error, { route: '/api/import/ticker-override/validate', method: 'POST' });
  }
}
