import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const [userSettings, app] = await Promise.all([
    db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id)).limit(1),
    db.select().from(schema.settings).limit(1),
  ]);

  return NextResponse.json({
    accountEmail: user.email,
    notificationEmail: userSettings[0]?.notificationEmail ?? '',
    emailNotifications: userSettings[0]?.emailNotifications ?? false,
    lastPriceFetch: app[0]?.lastPriceFetch ?? null,
    lastRebalanceCheck: app[0]?.lastRebalanceCheck ?? null,
    lastEmailPoll: app[0]?.lastEmailPoll ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await request.json();
  const notificationEmail: string | null = (body.notificationEmail || '').trim() || null;
  const emailNotifications: boolean = !!body.emailNotifications;

  const existing = await db.select({ userId: schema.userSettings.userId })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, user.id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.userSettings).values({
      userId: user.id,
      notificationEmail,
      emailNotifications,
    });
  } else {
    await db.update(schema.userSettings)
      .set({ notificationEmail, emailNotifications })
      .where(eq(schema.userSettings.userId, user.id));
  }

  return NextResponse.json({ success: true });
}
