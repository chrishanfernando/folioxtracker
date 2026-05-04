import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  const profiles = await db.select().from(schema.profiles);
  return NextResponse.json(profiles);
}

export async function PATCH(request: NextRequest) {
  const { id, name } = await request.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
  }
  await db.update(schema.profiles).set({ name: name.trim() }).where(eq(schema.profiles.id, id));
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  const result = await db.insert(schema.profiles).values({
    name: name.trim(),
    createdAt: new Date().toISOString().split('T')[0],
  }).returning();
  return NextResponse.json(result[0]);
}
