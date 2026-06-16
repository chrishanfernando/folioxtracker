import { db, schema } from '@/db';

export type CronJobName = 'prices' | 'prices_backfill' | 'rebalance' | 'email_poll';
export type CronJobStatus = 'ok' | 'error' | 'skipped';

/**
 * Upsert the row for a cron job's last run. `summary` is stringified to JSON
 * — keep it small (counts, not row dumps).
 */
export async function recordCronRun(
  jobName: CronJobName,
  status: CronJobStatus,
  summary?: unknown,
): Promise<void> {
  const lastRunAt = new Date().toISOString();
  const lastSummary = summary !== undefined ? JSON.stringify(summary) : null;
  await db.insert(schema.cronRuns).values({
    jobName,
    lastRunAt,
    lastStatus: status,
    lastSummary,
  }).onConflictDoUpdate({
    target: schema.cronRuns.jobName,
    set: { lastRunAt, lastStatus: status, lastSummary },
  });
}
