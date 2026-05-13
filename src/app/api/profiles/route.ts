import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-helpers';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profiles = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  return NextResponse.json(profiles);
}

export async function PATCH(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id, name } = await request.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
  }

  const result = await db.update(schema.profiles)
    .set({ name: name.trim() })
    .where(and(eq(schema.profiles.id, id), eq(schema.profiles.userId, user.id)))
    .returning({ id: schema.profiles.id });
  if (result.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const result = await db.insert(schema.profiles).values({
    name: name.trim(),
    createdAt: new Date().toISOString().split('T')[0],
    userId: user.id,
  }).returning();
  return NextResponse.json(result[0]);
}
