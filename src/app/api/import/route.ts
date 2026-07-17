import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { parseTransactionsFromExcel, parsePricesFromExcel } from '@/lib/import-parser';
import { ASSET_MAP, INACTIVE_ASSETS } from '@/lib/ticker-map';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { checkImportLimit } from '@/lib/rate-limit-guard';
import { requireUploadFile } from '@/lib/upload-guard';
import { trackAsync, EVENTS } from '@/lib/analytics';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;
    const limited = checkImportLimit(user.id, request.headers);
    if (limited) return limited;

    const profileId = await resolveProfileId(request, user.id);
    if (profileId instanceof NextResponse) return profileId;
    const formData = await request.formData();
    const file = requireUploadFile(formData);
    if (file instanceof NextResponse) return file;
    const isPreview = formData.get('preview') === 'true';

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

    // Parse the optional prices sheet up front so a parse failure can't
    // abort the transaction mid-write.
    let parsedPrices: ReturnType<typeof parsePricesFromExcel> = [];
    try {
      parsedPrices = parsePricesFromExcel(buffer);
    } catch { /* Prices sheet missing or unparseable */ }

    // Replace-import runs atomically: a failure anywhere rolls back the
    // delete, so the profile can't be left half-imported.
    const assetIdMap = new Map<string, number>();
    let importedTxs = 0;
    let importedPrices = 0;
    const BATCH = 50;

    await db.transaction(async (tdb) => {
      // 1. Seed assets from ASSET_MAP for this profile
      for (const [key, info] of Object.entries(allAssets)) {
        const existing = await tdb.select().from(schema.assets)
          .where(and(eq(schema.assets.symbol, key), eq(schema.assets.profileId, profileId)));

        if (existing.length > 0) {
          assetIdMap.set(key, existing[0].id);
        } else {
          const isActive = key in ASSET_MAP && !(key in INACTIVE_ASSETS);
          const result = await tdb.insert(schema.assets).values({
            profileId, symbol: info.symbol, name: info.name, displayTicker: info.displayTicker,
            yahooSymbol: info.yahooSymbol, category: info.category, platform: info.platform, isActive,
          }).returning();
          assetIdMap.set(key, result[0].id);
        }
      }

      // 2. Clear existing transactions for this profile's assets before re-importing
      const assetIds = [...assetIdMap.values()];
      if (assetIds.length > 0) {
        await tdb.delete(schema.transactions).where(inArray(schema.transactions.assetId, assetIds));
      }

      // 3. Batch-insert transactions
      const txRows = parsedTxs.flatMap(tx => {
        const assetId = assetIdMap.get(tx.asset);
        if (!assetId) { console.warn(`Unknown asset: ${tx.asset}`); return []; }
        const assetInfo = allAssets[tx.asset];
        return [{
          assetId, date: tx.date, action: tx.action, quantity: tx.quantity,
          unitPriceLocal: tx.unitPriceLocal, localCurrency: tx.fxRate ? 'USD' : 'AUD',
          fxRate: tx.fxRate, unitPriceAud: tx.unitPriceAud, splitMultiplier: tx.splitMultiplier,
          adjustedQty: tx.adjustedQty, totalAud: tx.totalAud,
          source: assetInfo?.platform || null, comment: tx.comment,
        }];
      });
      for (let i = 0; i < txRows.length; i += BATCH) {
        await tdb.insert(schema.transactions).values(txRows.slice(i, i + BATCH));
      }
      importedTxs = txRows.length;

      // 4. Batch-upsert prices from the optional prices sheet
      const priceRows = parsedPrices.flatMap(p => {
        const assetId = assetIdMap.get(p.asset);
        return assetId ? [{ assetId, date: p.date, priceAud: p.priceAud }] : [];
      });
      for (let i = 0; i < priceRows.length; i += BATCH) {
        await tdb.insert(schema.prices).values(priceRows.slice(i, i + BATCH))
          .onConflictDoUpdate({
            target: [schema.prices.assetId, schema.prices.date],
            set: { priceAud: sql`excluded.price_aud` },
          });
      }
      importedPrices = priceRows.length;
    });

    trackAsync(EVENTS.IMPORT_COMPLETED, { userId: user.id, props: { source: 'xlsx', inserted: importedTxs } });

    return NextResponse.json({
      success: true, transactions: importedTxs, prices: importedPrices, assets: assetIdMap.size,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
