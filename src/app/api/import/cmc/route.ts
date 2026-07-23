import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { parseCmcCsv } from '@/lib/import-parser';
import { ASSET_MAP, INACTIVE_ASSETS, CMC_TICKER_MAP } from '@/lib/ticker-map';
import { eq, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { resolveProfileId } from '@/lib/profile';
import { checkImportLimit } from '@/lib/rate-limit-guard';
import { requireUploadFile } from '@/lib/upload-guard';
import { trackAsync, EVENTS } from '@/lib/analytics';
import { lookupMerBps } from '@/lib/fees';

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

    const text = await file.text();
    const parsed = parseCmcCsv(text);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No buy/sell transactions found in CSV' }, { status: 400 });
    }

    const allAssets = { ...ASSET_MAP, ...INACTIVE_ASSETS };
    const assetIdMap = new Map<string, number>();
    const symbols = [...new Set(parsed.map(t => t.assetSymbol))];
    const newAssets: string[] = [];

    for (const symbol of symbols) {
      const info = allAssets[symbol];
      const existing = await db.select().from(schema.assets).where(and(eq(schema.assets.symbol, symbol), eq(schema.assets.profileId, profileId)));
      if (existing.length > 0) {
        assetIdMap.set(symbol, existing[0].id);
      } else {
        const ticker = symbol.split(':').pop() || symbol;
        newAssets.push(info?.displayTicker || ticker);
        if (!isPreview) {
          if (info) {
            const isActive = symbol in ASSET_MAP;
            const result = await db.insert(schema.assets).values({
              symbol: info.symbol, name: info.name, displayTicker: info.displayTicker,
              yahooSymbol: info.yahooSymbol, category: info.category, platform: info.platform,
              isActive, profileId, merBps: lookupMerBps(info.yahooSymbol),
            }).returning();
            assetIdMap.set(symbol, result[0].id);
          } else {
            const isAsx = symbol.startsWith('ASX:');
            // Yahoo denotes US share classes with a hyphen (BRK.B -> BRK-B, BF.B ->
            // BF-B); a dotted symbol yields no quote, so the holding would show $0.
            // Mirrors the same derivation in cmc-import.ts (the email-PDF path).
            const yahooSymbol = isAsx ? `${ticker}.AX` : ticker.replace(/\./g, '-');
            const category = isAsx ? 'Australia' : 'USA';
            const result = await db.insert(schema.assets).values({
              symbol, name: ticker, displayTicker: ticker, yahooSymbol, category,
              platform: 'CMC Markets', isActive: true, profileId, merBps: lookupMerBps(yahooSymbol),
            }).returning();
            assetIdMap.set(symbol, result[0].id);
          }
        }
      }
    }

    // Build preview or commit
    const previewRows: { date: string; ticker: string; action: string; quantity: number; unitPrice: number; total: number; status: string }[] = [];
    let imported = 0;
    let skipped = 0;
    const corrected = 0;

    for (const tx of parsed) {
      const assetId = assetIdMap.get(tx.assetSymbol);
      const ticker = allAssets[tx.assetSymbol]?.displayTicker || tx.cmcTicker;

      if (isPreview) {
        // For preview on new profile (no assetId yet), all are "new"
        if (!assetId) {
          previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'new' });
          imported++;
          continue;
        }
      } else {
        if (!assetId) continue;
      }

      if (assetId) {
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
          if (isPreview) {
            previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'duplicate' });
          } else {
            await db.update(schema.transactions).set({ source: 'CMC Markets' }).where(eq(schema.transactions.id, exactMatch[0].id));
          }
          skipped++;
          continue;
        }
      }

      if (isPreview) {
        previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'new' });
      } else {
        await db.insert(schema.transactions).values({
          assetId: assetId!, date: tx.date, action: tx.action, quantity: tx.quantity,
          unitPriceLocal: tx.unitPriceAud, localCurrency: 'AUD', fxRate: null,
          unitPriceAud: tx.unitPriceAud, splitMultiplier: 1, adjustedQty: tx.quantity,
          totalAud: tx.totalAud, source: 'CMC Markets', feeAud: tx.feeAud,
        });
      }
      imported++;
    }

    if (isPreview) {
      return NextResponse.json({
        preview: true,
        rows: previewRows,
        newAssets,
        summary: { new: imported, duplicates: skipped, corrections: corrected },
        tickers: [...new Set(parsed.map(t => t.cmcTicker))],
      });
    }

    trackAsync(EVENTS.IMPORT_COMPLETED, { userId: user.id, props: { source: 'cmc', inserted: imported } });

    return NextResponse.json({
      success: true, transactions: imported, assets: assetIdMap.size,
      skipped, corrected, tickers: [...new Set(parsed.map(t => t.cmcTicker))],
    });
  } catch (error) {
    console.error('CMC import error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
