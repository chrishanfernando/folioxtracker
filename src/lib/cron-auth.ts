import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Length comparison leaks only the secret's length, not its content.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Authenticate a cron request via `Authorization: Bearer <CRON_SECRET>`.
 * Header-only: secrets in query strings end up in access logs, proxies, and
 * error-tracker breadcrumbs. Vercel cron sends the header automatically.
 */
export function checkCronSecret(request: NextRequest): NextResponse | null {
  const expected = env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headerToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

  if (!headerToken || !safeEqual(headerToken, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
