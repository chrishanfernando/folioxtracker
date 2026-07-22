import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

// Public, unauthenticated readiness probe for uptime monitors (UptimeRobot, etc).
// Pings the DB so an outage surfaces as 503 and the monitor alerts, rather than
// a hollow 200 that hides a broken database. Kept dependency-light on purpose.
export async function GET() {
  try {
    await db.run(sql`select 1`);
    return NextResponse.json({ status: 'ok', time: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: 'degraded', error: 'database unreachable' },
      { status: 503 },
    );
  }
}
