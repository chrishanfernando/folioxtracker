import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { asc } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { apiError } from '@/lib/api-error';

interface CronStatusRow {
  jobName: string;
  lastRunAt: string;
  lastStatus: string;
  lastSummary: unknown;
}

export async function GET() {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const rows = await db.select().from(schema.cronRuns).orderBy(asc(schema.cronRuns.jobName));

    const payload: CronStatusRow[] = rows.map(r => ({
      jobName: r.jobName,
      lastRunAt: r.lastRunAt,
      lastStatus: r.lastStatus,
      lastSummary: r.lastSummary ? sanitizeSummary(safeParse(r.lastSummary)) : null,
    }));

    return NextResponse.json(payload);
  } catch (error) {
    return apiError(error, { route: '/api/cron/status', method: 'GET' });
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * Cron jobs are global, but this endpoint is visible to every authenticated
 * user. Error message arrays can name other users' CMC accounts or email
 * subjects, so collapse them to a count before returning.
 */
function sanitizeSummary(summary: unknown): unknown {
  if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
    const { errors, ...rest } = summary as Record<string, unknown>;
    if (Array.isArray(errors)) {
      return { ...rest, errorCount: errors.length };
    }
  }
  return summary;
}
