import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentPrices } from '@/lib/prices';
import { checkCronSecret } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const denied = checkCronSecret(request);
  if (denied) return denied;

  try {
    const results = await fetchCurrentPrices();
    return NextResponse.json({ success: true, updated: results.length });
  } catch (error) {
    console.error('Cron price fetch error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
