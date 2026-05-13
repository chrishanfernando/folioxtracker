import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { parseSwyftxCsv } from '@/lib/import-parser';
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

    const text = await file.text();
    const parsed = parseSwyftxCsv(text);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No buy/sell transactions found in CSV' }, { status: 400 });
    }

    const allAssets = { ...ASSET_MAP, ...INACTIVE_ASSETS };
    const assetIdMap = new Map<string, number>();
    const symbols = [...new Set(parsed.map(t => t.assetSymbol))];
    const newAssets: string[] = [];

    for (const symbol of symbols) {
      const info = allAssets[symbol];
      if (!info) { console.warn(`No asset info for symbol: ${symbol}`); continue; }

      const existing = await db.select().from(schema.assets).where(and(eq(schema.assets.symbol, symbol), eq(schema.assets.profileId, profileId)));
      if (existing.length > 0) {
        assetIdMap.set(symbol, existing[0].id);
      } else {
        newAssets.push(info.displayTicker);
        if (!isPreview) {
          const isActive = symbol in ASSET_MAP;
          const result = await db.insert(schema.assets).values({
            symbol: info.symbol, name: info.name, displayTicker: info.displayTicker,
            yahooSymbol: info.yahooSymbol, category: info.category, platform: info.platform,
            isActive, profileId,
          }).returning();
          assetIdMap.set(symbol, result[0].id);
        }
      }
    }

    const previewRows: { date: string; ticker: string; action: string; quantity: number; unitPrice: number; total: number; status: string }[] = [];
    let imported = 0;
    let skipped = 0;

    if (!isPreview) {
      // Clear previous Swyftx-imported transactions for these assets
      for (const assetId of assetIdMap.values()) {
        await db.delete(schema.transactions)
          .where(and(eq(schema.transactions.assetId, assetId), eq(schema.transactions.source, 'Swyftx')));
      }
    }

    for (const tx of parsed) {
      const assetId = assetIdMap.get(tx.assetSymbol);
      const ticker = allAssets[tx.assetSymbol]?.displayTicker || tx.swyftxTicker;

      if (!assetId) {
        if (isPreview) {
          previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'new' });
          imported++;
        }
        continue;
      }

      const existing = await db.select({ id: schema.transactions.id })
        .from(schema.transactions)
        .where(and(eq(schema.transactions.assetId, assetId), eq(schema.transactions.date, tx.date), eq(schema.transactions.action, tx.action), eq(schema.transactions.quantity, tx.quantity), eq(schema.transactions.unitPriceAud, tx.unitPriceAud)))
        .limit(1);

      if (existing.length > 0) {
        if (isPreview) {
          previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'duplicate' });
        }
        skipped++;
        continue;
      }

      if (isPreview) {
        previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'new' });
      } else {
        await db.insert(schema.transactions).values({
          assetId, date: tx.date, action: tx.action, quantity: tx.quantity,
          unitPriceLocal: tx.unitPriceAud, localCurrency: 'AUD', fxRate: null,
          unitPriceAud: tx.unitPriceAud, splitMultiplier: 1, adjustedQty: tx.quantity,
          totalAud: tx.totalAud, source: 'Swyftx',
        });
      }
      imported++;
    }

    if (isPreview) {
      return NextResponse.json({
        preview: true, rows: previewRows, newAssets,
        summary: { new: imported, duplicates: skipped, corrections: 0 },
        tickers: [...new Set(parsed.map(t => t.swyftxTicker))],
      });
    }

    return NextResponse.json({
      success: true, transactions: imported, skipped,
      assets: assetIdMap.size, tickers: [...new Set(parsed.map(t => t.swyftxTicker))],
    });
  } catch (error) {
    console.error('Swyftx import error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
