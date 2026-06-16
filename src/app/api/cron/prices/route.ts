import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentPrices } from '@/lib/prices';
import { checkCronSecret } from '@/lib/cron-auth';
import { db, schema } from '@/db';
import { recordCronRun } from '@/lib/cron-runs';

export async function GET(request: NextRequest) {
  const denied = checkCronSecret(request);
  if (denied) return denied;

  let updated = 0;
  let failed = 0;
  let profilesProcessed = 0;

  try {
    const profiles = await db.select({ id: schema.profiles.id }).from(schema.profiles);
    for (const p of profiles) {
      try {
        const results = await fetchCurrentPrices(p.id);
        updated += results.length;
        profilesProcessed++;
      } catch (error) {
        failed++;
        console.error(`Cron price fetch failed for profile ${p.id}:`, error);
      }
    }

    await recordCronRun('prices', 'ok', { profilesProcessed, updated, failed });
    return NextResponse.json({ success: true, profilesProcessed, updated, failed });
  } catch (error) {
    console.error('Cron price fetch error:', error);
    await recordCronRun('prices', 'error', { profilesProcessed, updated, failed });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
