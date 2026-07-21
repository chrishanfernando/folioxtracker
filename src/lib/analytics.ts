import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

/**
 * First-party, privacy-preserving product analytics.
 *
 * Design rules (enforced by convention — keep them true):
 *  - No dollar amounts. Portfolio value is bucketed via `valueBucket()` before
 *    it ever reaches `track()`.
 *  - No holdings, tickers, emails, or free text in `props`.
 *  - Capture is fire-and-forget and must NEVER throw into a request handler:
 *    analytics failing is not a reason for a user action to fail.
 *  - Respects the per-user opt-out flag in `user_settings`.
 *
 * Acquisition / activation / retention are NOT captured here — they are derived
 * from the `user` and `session` tables in `src/lib/metrics.ts`, which works
 * retroactively and needs no instrumentation. This module covers in-app
 * *feature usage* (what's used vs. ignored), which those tables can't see.
 */

export const EVENTS = {
  // Auth funnel (emitted from Better Auth database hooks).
  SIGNUP: 'signup',
  LOGIN: 'login',
  // Feature usage.
  TRANSACTION_CREATED: 'transaction_created',
  IMPORT_COMPLETED: 'import_completed',
  TARGET_SET: 'target_set',
  REBALANCE_VIEWED: 'rebalance_viewed',
  PORTFOLIO_TEMPLATE_APPLIED: 'portfolio_template_applied',
  DASHBOARD_VIEWED: 'dashboard_viewed',
  ACCOUNT_EXPORTED: 'account_exported',
  // Reliability.
  ERROR_OCCURRED: 'error_occurred',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type EventProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Bucket a portfolio value (AUD) into a coarse range so segmentation is
 * possible without storing a real balance. Returns a stable string label.
 */
export function valueBucket(aud: number | null | undefined): string {
  if (aud == null || !Number.isFinite(aud) || aud <= 0) return 'none';
  if (aud < 10_000) return '<10k';
  if (aud < 50_000) return '10k-50k';
  if (aud < 250_000) return '50k-250k';
  if (aud < 1_000_000) return '250k-1m';
  return '>1m';
}

async function isOptedOut(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ optOut: schema.userSettings.analyticsOptOut })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1);
    return rows[0]?.optOut === true;
  } catch {
    // If we can't read the flag, fail closed (don't capture) — privacy-safe default.
    return true;
  }
}

/**
 * Record a product-analytics event. Fire-and-forget: callers should NOT await
 * this in a way that can fail their request. Any error is swallowed.
 */
export async function track(
  name: EventName,
  opts: { userId?: string | null; props?: EventProps } = {},
): Promise<void> {
  try {
    const userId = opts.userId ?? null;
    if (userId && (await isOptedOut(userId))) return;

    let props: string | null = null;
    if (opts.props) {
      const clean: EventProps = {};
      for (const [k, v] of Object.entries(opts.props)) {
        if (v !== undefined) clean[k] = v;
      }
      props = JSON.stringify(clean);
    }

    await db.insert(schema.analyticsEvents).values({
      userId,
      name,
      props,
      createdAt: new Date(),
    });
  } catch {
    // Analytics must never break a request. Swallow.
  }
}

/**
 * Convenience wrapper for use inside route handlers where awaiting analytics
 * would add latency to the user's response. Schedules the insert without
 * blocking and swallows rejections.
 */
export function trackAsync(name: EventName, opts: { userId?: string | null; props?: EventProps } = {}): void {
  void track(name, opts);
}
