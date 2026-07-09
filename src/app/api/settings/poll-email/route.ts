import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth-helpers';
import { pollCmcEmails } from '@/lib/email-poll';
import { checkCooldown } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-error';

const POLL_COOLDOWN_MS = 60_000;

/**
 * Manually trigger the CMC email poll from the settings page. Session-authed
 * replacement for calling /api/cron/email with the cron secret — the secret
 * must never reach the browser. The poll is global (all account mappings), so
 * the response returns counts only; per-account error details stay in server
 * logs where they can't leak another user's data.
 */
export async function POST() {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const cooldown = checkCooldown('email-poll', user.id, POLL_COOLDOWN_MS);
    if (!cooldown.allowed) {
      return NextResponse.json(
        { error: 'Poll already ran recently. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(cooldown.retryAfterMs / 1000)) } },
      );
    }

    const result = await pollCmcEmails();
    if (result.errors.length > 0) {
      console.warn('[poll-email] completed with errors', { count: result.errors.length, errors: result.errors });
    }
    return NextResponse.json({
      success: true,
      processed: result.processed,
      imported: result.imported,
      skipped: result.skipped,
      errorCount: result.errors.length,
    });
  } catch (error) {
    return apiError(error, { route: '/api/settings/poll-email', method: 'POST' });
  }
}
