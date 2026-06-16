import { NextRequest, NextResponse } from 'next/server';
import { calculateDrift } from '@/lib/rebalance';
import { sendRebalanceAlert } from '@/lib/email';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { checkCronSecret } from '@/lib/cron-auth';
import { recordCronRun } from '@/lib/cron-runs';

export async function GET(request: NextRequest) {
  const denied = checkCronSecret(request);
  if (denied) return denied;

  let notified = 0;

  try {
    // Walk every user with notifications enabled, evaluate drift per profile,
    // and send one summary email per user when any of their profiles drift.
    const subscribers = await db.select({
      userId: schema.userSettings.userId,
      notificationEmail: schema.userSettings.notificationEmail,
      accountEmail: schema.user.email,
    })
      .from(schema.userSettings)
      .innerJoin(schema.user, eq(schema.user.id, schema.userSettings.userId))
      .where(eq(schema.userSettings.emailNotifications, true));

    for (const sub of subscribers) {
      const profiles = await db.select({ id: schema.profiles.id })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, sub.userId));

      const drifts = (await Promise.all(profiles.map(p => calculateDrift(p.id)))).flat();
      const needsRebalance = drifts.filter(d => d.needsRebalance);

      if (needsRebalance.length > 0) {
        const to = sub.notificationEmail || sub.accountEmail;
        if (to) {
          await sendRebalanceAlert(to, needsRebalance);
          notified++;
        }
      }
    }

    await recordCronRun('rebalance', 'ok', { subscribers: subscribers.length, notified });
    return NextResponse.json({ success: true, notified });
  } catch (error) {
    console.error('Rebalance check error:', error);
    await recordCronRun('rebalance', 'error', { notified });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
