import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export function checkCronSecret(request: NextRequest): NextResponse | null {
  const expected = env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headerToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const queryToken = request.nextUrl.searchParams.get('secret') ?? '';
  const presented = headerToken || queryToken;

  if (!presented || presented !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
