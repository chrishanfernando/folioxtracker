import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentPrices } from '@/lib/prices';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await fetchCurrentPrices();
    return NextResponse.json({ success: true, updated: results.length });
  } catch (error) {
    console.error('Cron price fetch error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
