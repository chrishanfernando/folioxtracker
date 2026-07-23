import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { parseStakeXlsx } from '@/lib/import-parser';
import { INACTIVE_ASSETS } from '@/lib/ticker-map';
import { resolveAssetSymbol, ResolvedAsset } from '@/lib/ticker-overrides';
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

    const buffer = await file.arrayBuffer();
    const parsed = parseStakeXlsx(buffer);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No buy/sell transactions found in Stake file' }, { status: 400 });
    }

    // Step 1 — resolve each distinct source ticker to a canonical symbol,
    // consulting profile-scoped DB overrides first, then the code seed maps.
    const resolutionByTicker = new Map<string, ResolvedAsset | null>();
    for (const ticker of new Set(parsed.map(t => t.stakeTicker))) {
      resolutionByTicker.set(ticker, await resolveAssetSymbol('stake', ticker, profileId));
    }

    // Step 2 — for each resolved symbol, match an existing DB asset by
    // (symbol, profileId) — even when absent from ASSET_MAP — otherwise create
    // it from override/seed metadata (on confirm). A symbol that resolves but
    // has neither an existing asset nor metadata cannot be imported and is
    // surfaced as unmapped.
    const assetIdBySymbol = new Map<string, number>();   // existing or created
    const pendingNewSymbols = new Set<string>();          // creatable, not yet created (preview)
    const displayBySymbol = new Map<string, string>();
    const newAssets: string[] = [];
    // Source tickers that cannot resolve to an importable asset.
    const unmappedTickers = new Set<string>();

    for (const [ticker, res] of resolutionByTicker) {
      if (!res) { unmappedTickers.add(ticker); continue; }
      const { symbol, info } = res;
      if (assetIdBySymbol.has(symbol) || pendingNewSymbols.has(symbol)) continue;

      const existing = await db.select().from(schema.assets)
        .where(and(eq(schema.assets.symbol, symbol), eq(schema.assets.profileId, profileId)))
        .limit(1);
      if (existing.length > 0) {
        assetIdBySymbol.set(symbol, existing[0].id);
        displayBySymbol.set(symbol, existing[0].displayTicker);
        continue;
      }
      if (!info) { unmappedTickers.add(ticker); continue; }

      displayBySymbol.set(symbol, info.displayTicker);
      newAssets.push(info.displayTicker);
      if (isPreview) {
        pendingNewSymbols.add(symbol);
      } else {
        const isActive = !(symbol in INACTIVE_ASSETS);
        const result = await db.insert(schema.assets).values({
          symbol: info.symbol, name: info.name, displayTicker: info.displayTicker,
          yahooSymbol: info.yahooSymbol, category: info.category, platform: info.platform,
          isActive, profileId, merBps: lookupMerBps(info.yahooSymbol),
        }).returning();
        assetIdBySymbol.set(symbol, result[0].id);
      }
    }

    const previewRows: { date: string; ticker: string; action: string; quantity: number; unitPrice: number; total: number; status: string }[] = [];
    let imported = 0;
    let skipped = 0;
    let unknownRows = 0;
    const corrected = 0;

    for (const tx of parsed) {
      const res = resolutionByTicker.get(tx.stakeTicker);
      const symbol = res?.symbol;
      const importable = !!symbol && (assetIdBySymbol.has(symbol) || pendingNewSymbols.has(symbol));

      if (!importable) {
        // Unmapped — surfaced, never imported.
        unknownRows++;
        if (isPreview) {
          previewRows.push({ date: tx.date, ticker: tx.stakeTicker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'unknown' });
        }
        continue;
      }

      const ticker = displayBySymbol.get(symbol!) || tx.stakeTicker;
      const assetId = assetIdBySymbol.get(symbol!);

      // Preview of a to-be-created asset: no existing rows, so every row is new.
      if (assetId === undefined) {
        if (isPreview) {
          previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'new' });
        }
        imported++;
        continue;
      }

      const exactMatch = await db.select({ id: schema.transactions.id })
        .from(schema.transactions)
        .where(and(eq(schema.transactions.assetId, assetId), eq(schema.transactions.date, tx.date), eq(schema.transactions.action, tx.action), eq(schema.transactions.quantity, tx.quantity), eq(schema.transactions.unitPriceAud, tx.unitPriceAud)))
        .limit(1);

      if (exactMatch.length > 0) {
        if (isPreview) {
          previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'duplicate' });
        } else {
          await db.update(schema.transactions).set({ source: 'Stake' }).where(eq(schema.transactions.id, exactMatch[0].id));
        }
        skipped++;
        continue;
      }

      if (isPreview) {
        previewRows.push({ date: tx.date, ticker, action: tx.action, quantity: tx.quantity, unitPrice: tx.unitPriceAud, total: tx.totalAud, status: 'new' });
      } else {
        await db.insert(schema.transactions).values({
          assetId, date: tx.date, action: tx.action, quantity: tx.quantity,
          unitPriceLocal: tx.unitPriceLocal, localCurrency: tx.localCurrency,
          fxRate: tx.fxRate, unitPriceAud: tx.unitPriceAud, splitMultiplier: 1,
          adjustedQty: tx.quantity, totalAud: tx.totalAud, comment: '[Stake]',
          feeAud: tx.feeAud,
        });
      }
      imported++;
    }

    const unknownTickers = [...unmappedTickers];
    if (isPreview) {
      return NextResponse.json({
        preview: true, rows: previewRows, newAssets,
        summary: { new: imported, duplicates: skipped, corrections: corrected, unknown: unknownRows },
        tickers: [...new Set(parsed.map(t => t.stakeTicker))],
        unknownTickers,
      });
    }

    trackAsync(EVENTS.IMPORT_COMPLETED, { userId: user.id, props: { source: 'stake', inserted: imported } });

    return NextResponse.json({
      success: true, transactions: imported, assets: assetIdBySymbol.size,
      skipped, corrected, tickers: [...new Set(parsed.map(t => t.stakeTicker))],
      unknownTickers,
    });
  } catch (error) {
    console.error('Stake import error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
