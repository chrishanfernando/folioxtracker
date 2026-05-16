import YahooFinance from 'yahoo-finance2';
import { db, schema } from '@/db';
import { eq, and, or } from 'drizzle-orm';
import { format } from 'date-fns';

const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
const FX_SYMBOL = 'AUDUSD=X';

async function getAudUsdRate(): Promise<number> {
  try {
    const quote = await yf.quote(FX_SYMBOL);
    return quote.regularMarketPrice ?? 0.65;
  } catch {
    return 0.65;
  }
}

export async function ensureBenchmarkAssetExists(yahooSymbol: string): Promise<number> {
  const existing = await db.select().from(schema.assets)
    .where(eq(schema.assets.yahooSymbol, yahooSymbol))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const result = await db.insert(schema.assets).values({
    profileId: 1,
    symbol: yahooSymbol.split('.')[0],
    name: `Benchmark: ${yahooSymbol}`,
    displayTicker: yahooSymbol.split('.')[0],
    yahooSymbol,
    category: 'Benchmark',
    isActive: false,
  }).returning({ id: schema.assets.id });

  return result[0].id;
}

/**
 * Fetch a single live AUD price for an ad-hoc Yahoo symbol, without requiring
 * the asset to exist in the local DB. Used by the rebalance recommender when
 * suggesting purchases of ETFs the user doesn't yet hold.
 */
export async function fetchLivePriceAud(yahooSymbol: string): Promise<number> {
  try {
    if (yahooSymbol.endsWith('.AX') || yahooSymbol.endsWith('-AUD')) {
      const quote = await yf.quote(yahooSymbol);
      return quote.regularMarketPrice ?? 0;
    }
    const [quote, audUsd] = await Promise.all([
      yf.quote(yahooSymbol),
      getAudUsdRate(),
    ]);
    const priceUsd = quote.regularMarketPrice ?? 0;
    return audUsd > 0 ? priceUsd / audUsd : 0;
  } catch {
    return 0;
  }
}

export async function fetchCurrentPrices(): Promise<{ symbol: string; priceAud: number; priceUsd?: number; fxRate?: number }[]> {
  const assets = await db.select().from(schema.assets).where(
    or(eq(schema.assets.isActive, true), eq(schema.assets.category, 'Benchmark'))
  );
  const audUsdRate = await getAudUsdRate();
  const results: { symbol: string; priceAud: number; priceUsd?: number; fxRate?: number }[] = [];
  const today = format(new Date(), 'yyyy-MM-dd');

  for (const asset of assets) {
    try {
      let priceAud: number;
      let priceUsd: number | undefined;
      let fxRate: number | undefined;

      if (asset.yahooSymbol === 'GC=F') {
        const quote = await yf.quote('GC=F');
        priceUsd = quote.regularMarketPrice ?? 0;
        fxRate = audUsdRate;
        priceAud = (priceUsd ?? 0) / audUsdRate;
      } else if (asset.yahooSymbol.endsWith('.AX') || asset.yahooSymbol.endsWith('-AUD')) {
        const quote = await yf.quote(asset.yahooSymbol);
        priceAud = quote.regularMarketPrice ?? 0;
      } else {
        const quote = await yf.quote(asset.yahooSymbol);
        priceUsd = quote.regularMarketPrice ?? 0;
        fxRate = audUsdRate;
        priceAud = (priceUsd ?? 0) / audUsdRate;
      }

      const existing = await db.select().from(schema.prices)
        .where(and(eq(schema.prices.assetId, asset.id), eq(schema.prices.date, today)));

      if (existing.length > 0) {
        await db.update(schema.prices)
          .set({ priceAud, priceUsd, fxRate })
          .where(eq(schema.prices.id, existing[0].id));
      } else {
        await db.insert(schema.prices).values({
          assetId: asset.id,
          date: today,
          priceAud,
          priceUsd,
          fxRate,
        });
      }

      results.push({ symbol: asset.symbol, priceAud, priceUsd, fxRate });
    } catch (error) {
      console.error(`Failed to fetch price for ${asset.symbol}:`, error);
    }
  }

  await db.update(schema.settings).set({ lastPriceFetch: new Date().toISOString() });

  return results;
}

export async function fetchHistoricalPrices(assetId: number, yahooSymbol: string, isAud: boolean, startDate: string, interval: '1wk' | '1d' = '1wk'): Promise<number> {
  let count = 0;
  try {
    const result = await yf.chart(yahooSymbol, {
      period1: startDate,
      interval,
    });

    let fxRates: Map<string, number> | null = null;
    if (!isAud) {
      try {
        const fxResult = await yf.chart(FX_SYMBOL, {
          period1: startDate,
          interval,
        });
        fxRates = new Map(
          fxResult.quotes
            .filter(r => r.date && r.close != null)
            .map(r => [format(r.date!, 'yyyy-MM-dd'), r.close!])
        );
      } catch {
        // If FX fetch fails, we'll use fallback rate
      }
    }

    for (const row of result.quotes) {
      if (!row.date || row.close == null) continue;
      const date = format(row.date, 'yyyy-MM-dd');
      const price = row.close;

      let priceAud: number;
      let priceUsd: number | undefined;
      let fxRate: number | undefined;

      if (isAud) {
        priceAud = price;
      } else {
        priceUsd = price;
        fxRate = fxRates?.get(date) || 0.65;
        priceAud = price / fxRate;
      }

      try {
        await db.insert(schema.prices).values({
          assetId,
          date,
          priceAud,
          priceUsd,
          fxRate,
        }).onConflictDoUpdate({
          target: [schema.prices.assetId, schema.prices.date],
          set: { priceAud, priceUsd, fxRate },
        });
        count++;
      } catch {
        // Skip errors
      }
    }
  } catch (error) {
    console.error(`Failed to fetch historical prices for asset ${assetId} (${yahooSymbol}):`, error);
  }
  return count;
}
