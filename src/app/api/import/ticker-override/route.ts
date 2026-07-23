import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { tickerOverrideSchema } from '@/lib/validation/primitives';
import { apiError, parseJsonBody, AppError } from '@/lib/api-error';
import { fetchLivePriceAud } from '@/lib/prices';

// Persists a per-profile resolution of a broker's raw ticker to a canonical
// asset. resolveProfileId 404s on a profile the user does not own, so the
// upsert is always scoped to an owned profile. The Yahoo symbol is re-validated
// server-side so a bad symbol can never be trusted from the client.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;

    const body = await parseJsonBody(request, tickerOverrideSchema);

    const priceAud = await fetchLivePriceAud(body.yahooSymbol);
    if (!(priceAud > 0)) {
      throw new AppError(400, `Could not verify Yahoo symbol "${body.yahooSymbol}" — no live quote found`);
    }

    const values = {
      userId: user.id,
      profileId,
      source: body.source,
      sourceTicker: body.sourceTicker,
      symbol: body.symbol,
      name: body.name,
      displayTicker: body.displayTicker,
      yahooSymbol: body.yahooSymbol,
      category: body.category,
      createdAt: new Date(),
    };

    // Upsert on the unique (profileId, source, sourceTicker) — re-mapping a
    // ticker replaces the prior override rather than duplicating it.
    const existing = await db.select({ id: schema.tickerOverrides.id })
      .from(schema.tickerOverrides)
      .where(and(
        eq(schema.tickerOverrides.profileId, profileId),
        eq(schema.tickerOverrides.source, body.source),
        eq(schema.tickerOverrides.sourceTicker, body.sourceTicker),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(schema.tickerOverrides).set(values).where(eq(schema.tickerOverrides.id, existing[0].id));
    } else {
      await db.insert(schema.tickerOverrides).values(values);
    }

    return NextResponse.json({ ok: true, symbol: body.symbol, sourceTicker: body.sourceTicker });
  } catch (error) {
    return apiError(error, { route: '/api/import/ticker-override', method: 'POST' });
  }
}
