import { NextRequest, NextResponse } from 'next/server';
import { calculateDrift } from '@/lib/rebalance';
import { sendRebalanceAlert } from '@/lib/email';
import { db, schema } from '@/db';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const drift = await calculateDrift();
    const needsRebalance = drift.filter(d => d.needsRebalance);

    if (needsRebalance.length > 0) {
      const settings = await db.select().from(schema.settings);
      const email = settings[0]?.email;
      const notificationsEnabled = settings[0]?.emailNotifications;

      if (email && notificationsEnabled) {
        await sendRebalanceAlert(email, needsRebalance);
      }
    }

    await db.update(schema.settings).set({ lastRebalanceCheck: new Date().toISOString() });

    return NextResponse.json({ success: true, drifts: needsRebalance.length });
  } catch (error) {
    console.error('Rebalance check error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
