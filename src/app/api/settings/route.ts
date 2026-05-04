import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function GET() {
  const settings = await db.select().from(schema.settings);
  if (settings.length === 0) {
    return NextResponse.json({ needsSetup: true });
  }
  return NextResponse.json({
    email: settings[0].email,
    emailNotifications: settings[0].emailNotifications,
    lastPriceFetch: settings[0].lastPriceFetch,
    lastRebalanceCheck: settings[0].lastRebalanceCheck,
    lastEmailPoll: settings[0].lastEmailPoll,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const settings = await db.select().from(schema.settings);
  if (settings.length === 0) {
    return NextResponse.json({ error: 'Not set up' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.email !== undefined) updates.email = body.email;
  if (body.emailNotifications !== undefined) updates.emailNotifications = body.emailNotifications;

  if (body.newPassword && body.currentPassword) {
    const valid = await verifyPassword(body.currentPassword, settings[0].passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
    }
    updates.passwordHash = await hashPassword(body.newPassword);
  }

  if (Object.keys(updates).length > 0) {
    await db.update(schema.settings).set(updates).where(undefined as never);
  }

  return NextResponse.json({ success: true });
}
