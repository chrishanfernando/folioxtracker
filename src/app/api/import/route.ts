import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { parseTransactionsFromExcel, parsePricesFromExcel } from '@/lib/import-parser';
import { ASSET_MAP, INACTIVE_ASSETS } from '@/lib/ticker-map';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const isPreview = formData.get('preview') === 'true';
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const allAssets = { ...ASSET_MAP, ...INACTIVE_ASSETS };

    // Parse transactions
    const parsedTxs = parseTransactionsFromExcel(buffer);

    if (isPreview) {
      const rows = parsedTxs.map(tx => {
        const info = allAssets[tx.asset];
        return {
          date: tx.date,
          ticker: info?.displayTicker || tx.asset,
          action: tx.action,
          quantity: tx.quantity,
          unitPrice: tx.unitPriceAud,
          total: tx.totalAud,
          status: 'new' as const,
        };
      });

      // Check for prices sheet
      let priceCount = 0;
      try {
        const parsedPrices = parsePricesFromExcel(buffer);
        priceCount = parsedPrices.length;
      } catch { /* no prices sheet */ }

      const tickers = [...new Set(parsedTxs.map(tx => allAssets[tx.asset]?.displayTicker || tx.asset))];

      return NextResponse.json({
        preview: true,
        rows,
        newAssets: tickers,
        summary: { new: rows.length, duplicates: 0, corrections: 0 },
        tickers,
        prices: priceCount,
        warning: 'This will replace all existing Excel-sourced transactions for this profile.',
      });
    }

    // 1. Seed assets from ASSET_MAP for this profile
    const assetIdMap = new Map<string, number>();

    for (const [key, info] of Object.entries(allAssets)) {
      const existing = await db.select().from(schema.assets)
        .where(and(eq(schema.assets.symbol, key), eq(schema.assets.profileId, profileId)));

      if (existing.length > 0) {
        assetIdMap.set(key, existing[0].id);
      } else {
        const isActive = key in ASSET_MAP && !(key in INACTIVE_ASSETS);
        const result = await db.insert(schema.assets).values({
          profileId, symbol: info.symbol, name: info.name, displayTicker: info.displayTicker,
          yahooSymbol: info.yahooSymbol, category: info.category, platform: info.platform, isActive,
        }).returning();
        assetIdMap.set(key, result[0].id);
      }
    }

    // 2. Clear existing transactions for this profile's assets before re-importing
    for (const assetId of assetIdMap.values()) {
      await db.delete(schema.transactions).where(eq(schema.transactions.assetId, assetId));
    }

    let importedTxs = 0;
    for (const tx of parsedTxs) {
      const assetId = assetIdMap.get(tx.asset);
      if (!assetId) { console.warn(`Unknown asset: ${tx.asset}`); continue; }

      const assetInfo = allAssets[tx.asset];
      await db.insert(schema.transactions).values({
        assetId, date: tx.date, action: tx.action, quantity: tx.quantity,
        unitPriceLocal: tx.unitPriceLocal, localCurrency: tx.fxRate ? 'USD' : 'AUD',
        fxRate: tx.fxRate, unitPriceAud: tx.unitPriceAud, splitMultiplier: tx.splitMultiplier,
        adjustedQty: tx.adjustedQty, totalAud: tx.totalAud,
        source: assetInfo?.platform || null, comment: tx.comment,
      });
      importedTxs++;
    }

    // 3. Try to parse prices from spreadsheet (optional)
    let importedPrices = 0;
    try {
      const parsedPrices = parsePricesFromExcel(buffer);
      for (const p of parsedPrices) {
        const assetId = assetIdMap.get(p.asset);
        if (!assetId) continue;
        try {
          await db.insert(schema.prices).values({ assetId, date: p.date, priceAud: p.priceAud })
            .onConflictDoUpdate({ target: [schema.prices.assetId, schema.prices.date], set: { priceAud: p.priceAud } });
          importedPrices++;
        } catch { /* Skip on error */ }
      }
    } catch { /* Prices sheet missing or unparseable */ }

    return NextResponse.json({
      success: true, transactions: importedTxs, prices: importedPrices, assets: assetIdMap.size,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
