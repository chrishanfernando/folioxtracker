import { NextResponse } from 'next/server';
import { checkSlidingLimit, clientIpFromHeaders } from '@/lib/rate-limit';

/**
 * Enforce a per-user + per-IP rate limit for import endpoints. Returns a 429
 * NextResponse when exceeded, or null when the request is allowed to proceed.
 *
 * Import parsing is CPU-heavy on the small Vercel plan, so we're strict:
 * default 10 imports per minute per user, 30 per minute per IP.
 */
export function checkImportLimit(userId: string, headers: Headers): NextResponse | null {
  const user = checkSlidingLimit(`import:user:${userId}`, 10, 60_000);
  if (!user.allowed) {
    return NextResponse.json(
      { error: 'Too many imports. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(user.retryAfterSeconds) } },
    );
  }
  const ip = clientIpFromHeaders(headers);
  const ipCheck = checkSlidingLimit(`import:ip:${ip}`, 30, 60_000);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many imports from this network. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(ipCheck.retryAfterSeconds) } },
    );
  }
  return null;
}
