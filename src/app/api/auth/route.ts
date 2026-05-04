import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { hashPassword, verifyPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { password, action } = await request.json();

  if (action === 'check') {
    const existing = await db.select().from(schema.settings);
    if (existing.length === 0) {
      return NextResponse.json({ needsSetup: true });
    }
    return NextResponse.json({ needsSetup: false });
  }

  if (action === 'setup') {
    // First-time setup
    const existing = await db.select().from(schema.settings);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Already set up' }, { status: 400 });
    }
    const hash = await hashPassword(password);
    await db.insert(schema.settings).values({ passwordHash: hash });
    const token = await createToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === 'true',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  }

  // Login
  const settings = await db.select().from(schema.settings);
  if (settings.length === 0) {
    return NextResponse.json({ needsSetup: true });
  }

  const valid = await verifyPassword(password, settings[0].passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await createToken();
  const response = NextResponse.json({ success: true });
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.FORCE_HTTPS === 'true',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });
  return response;
}
