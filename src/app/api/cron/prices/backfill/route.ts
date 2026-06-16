import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { fetchHistoricalPrices } from '@/lib/prices';
import { checkCronSecret } from '@/lib/cron-auth';
import { recordCronRun } from '@/lib/cron-runs';

const YAHOO_SLEEP_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  return runBackfill(request);
}

export async function POST(request: NextRequest) {
  return runBackfill(request);
}

async function runBackfill(request: NextRequest) {
  const denied = checkCronSecret(request);
  if (denied) return denied;

  let assetsProcessed = 0;
  let rowsWritten = 0;
  let failed = 0;

  try {
    const profiles = await db.select({ id: schema.profiles.id })
      .from(schema.profiles)
      .orderBy(asc(schema.profiles.id));

    const firstTx = await db.select({ date: schema.transactions.date })
      .from(schema.transactions)
      .orderBy(asc(schema.transactions.date))
      .limit(1);
    const defaultStart = firstTx[0]?.date || '2017-03-01';

    for (const profile of profiles) {
      const assets = await db.select().from(schema.assets)
        .where(eq(schema.assets.profileId, profile.id));

      for (const asset of assets) {
        try {
          const isAud = asset.yahooSymbol.endsWith('.AX') || asset.yahooSymbol.endsWith('-AUD');
          const weekly = await fetchHistoricalPrices(
            profile.id,
            { id: asset.id, yahooSymbol: asset.yahooSymbol, isAud },
            defaultStart,
            '1wk',
          );
          rowsWritten += weekly;
          await sleep(YAHOO_SLEEP_MS);
          assetsProcessed++;
        } catch (error) {
          failed++;
          console.error(`Backfill failed for asset ${asset.id} (${asset.yahooSymbol}):`, error);
        }
      }
    }

    await recordCronRun('prices_backfill', 'ok', { assetsProcessed, rowsWritten, failed });
    return NextResponse.json({ success: true, assetsProcessed, rowsWritten, failed });
  } catch (error) {
    console.error('Cron backfill error:', error);
    await recordCronRun('prices_backfill', 'error', { assetsProcessed, rowsWritten, failed });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
