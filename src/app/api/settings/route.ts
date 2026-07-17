import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';
import { apiError, parseJsonBody } from '@/lib/api-error';
import { env } from '@/lib/env';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const userSettings = await db.select().from(schema.userSettings)
    .where(eq(schema.userSettings.userId, user.id))
    .limit(1);

  return NextResponse.json({
    accountEmail: user.email,
    notificationEmail: userSettings[0]?.notificationEmail ?? '',
    emailNotifications: userSettings[0]?.emailNotifications ?? false,
    analyticsOptOut: userSettings[0]?.analyticsOptOut ?? false,
    emailPollEnabled: env.EMAIL_POLL_ENABLED,
  });
}

const settingsPutSchema = z.object({
  notificationEmail: z.string().trim().max(255).optional().nullable(),
  emailNotifications: z.boolean().optional(),
  analyticsOptOut: z.boolean().optional(),
}).strict();

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const body = await parseJsonBody(request, settingsPutSchema);
    const notificationEmail: string | null = (body.notificationEmail || '').trim() || null;
    const emailNotifications: boolean = !!body.emailNotifications;
    const analyticsOptOut: boolean = !!body.analyticsOptOut;

    const existing = await db.select({ userId: schema.userSettings.userId })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, user.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.userSettings).values({
        userId: user.id,
        notificationEmail,
        emailNotifications,
        analyticsOptOut,
      });
    } else {
      await db.update(schema.userSettings)
        .set({ notificationEmail, emailNotifications, analyticsOptOut })
        .where(eq(schema.userSettings.userId, user.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: '/api/settings', method: 'PUT' });
  }
}
