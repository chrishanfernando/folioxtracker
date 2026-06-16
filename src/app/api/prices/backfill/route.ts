import { NextResponse } from 'next/server';

/**
 * Removed: this user-facing backfill endpoint was deleted in launch-hardening
 * Phase 2. Backfill now runs only via `/api/cron/prices/backfill` gated by
 * `CRON_SECRET`.
 */
export function POST(): NextResponse {
  return NextResponse.json({ error: 'Gone' }, { status: 410 });
}

export function GET(): NextResponse {
  return NextResponse.json({ error: 'Gone' }, { status: 410 });
}
