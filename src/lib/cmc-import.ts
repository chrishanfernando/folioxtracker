import { db, schema } from '@/db';
import { ASSET_MAP, INACTIVE_ASSETS, CMC_TICKER_MAP } from '@/lib/ticker-map';
import { eq, and } from 'drizzle-orm';

export interface ParsedCmcTx {
  date: string;
  assetSymbol: string;
  cmcTicker: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  unitPriceAud: number;
  totalAud: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  tickers: string[];
}

export async function importCmcTransactions(
  parsed: ParsedCmcTx[],
  profileId: number,
  source: string = 'CMC Markets',
): Promise<ImportResult> {
  const allAssets = { ...ASSET_MAP, ...INACTIVE_ASSETS };
  const assetIdMap = new Map<string, number>();
  const symbols = [...new Set(parsed.map(t => t.assetSymbol))];

  for (const symbol of symbols) {
    const info = allAssets[symbol];
    const existing = await db.select().from(schema.assets)
      .where(and(eq(schema.assets.symbol, symbol), eq(schema.assets.profileId, profileId)));

    if (existing.length > 0) {
      assetIdMap.set(symbol, existing[0].id);
    } else {
      const ticker = symbol.split(':').pop() || symbol;
      if (info) {
        const isActive = symbol in ASSET_MAP;
        const result = await db.insert(schema.assets).values({
          symbol: info.symbol, name: info.name, displayTicker: info.displayTicker,
          yahooSymbol: info.yahooSymbol, category: info.category, platform: info.platform,
          isActive, profileId,
        }).returning();
        assetIdMap.set(symbol, result[0].id);
      } else {
        const isAsx = symbol.startsWith('ASX:');
        const yahooSymbol = isAsx ? `${ticker}.AX` : ticker;
        const category = isAsx ? 'Australia' : 'USA';
        const result = await db.insert(schema.assets).values({
          symbol, name: ticker, displayTicker: ticker, yahooSymbol, category,
          platform: 'CMC Markets', isActive: true, profileId,
        }).returning();
        assetIdMap.set(symbol, result[0].id);
      }
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const tx of parsed) {
    const assetId = assetIdMap.get(tx.assetSymbol);
    if (!assetId) continue;

    // Duplicate detection
    const exactMatch = await db.select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.assetId, assetId),
        eq(schema.transactions.date, tx.date),
        eq(schema.transactions.action, tx.action),
        eq(schema.transactions.quantity, tx.quantity),
        eq(schema.transactions.unitPriceAud, tx.unitPriceAud),
      ))
      .limit(1);

    if (exactMatch.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(schema.transactions).values({
      assetId, date: tx.date, action: tx.action, quantity: tx.quantity,
      unitPriceLocal: tx.unitPriceAud, localCurrency: 'AUD', fxRate: null,
      unitPriceAud: tx.unitPriceAud, splitMultiplier: 1, adjustedQty: tx.quantity,
      totalAud: tx.totalAud, source,
    });
    imported++;
  }

  return {
    imported,
    skipped,
    tickers: [...new Set(parsed.map(t => t.cmcTicker))],
  };
}
