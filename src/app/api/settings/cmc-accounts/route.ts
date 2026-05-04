import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  const mappings = await db.select().from(schema.cmcAccountMappings);
  const profiles = await db.select().from(schema.profiles);
  return NextResponse.json({ mappings, profiles });
}

export async function POST(request: NextRequest) {
  const { accountNumber, profileId, label } = await request.json();
  if (!accountNumber || !profileId) {
    return NextResponse.json({ error: 'Account number and profile are required' }, { status: 400 });
  }

  // Upsert
  const existing = await db.select().from(schema.cmcAccountMappings)
    .where(eq(schema.cmcAccountMappings.cmcAccountNumber, accountNumber));

  if (existing.length > 0) {
    await db.update(schema.cmcAccountMappings)
      .set({ profileId, label: label || null })
      .where(eq(schema.cmcAccountMappings.id, existing[0].id));
    return NextResponse.json({ success: true, updated: true });
  }

  const result = await db.insert(schema.cmcAccountMappings)
    .values({ cmcAccountNumber: accountNumber, profileId, label: label || null })
    .returning();
  return NextResponse.json({ success: true, id: result[0].id });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  await db.delete(schema.cmcAccountMappings).where(eq(schema.cmcAccountMappings.id, id));
  return NextResponse.json({ success: true });
}
