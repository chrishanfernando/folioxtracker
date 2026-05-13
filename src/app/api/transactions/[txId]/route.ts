import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireTransactionOwnership, requireUser } from '@/lib/auth-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const { txId } = await params;
    const id = parseInt(txId);

    const ownership = await requireTransactionOwnership(id, user.id);
    if (ownership instanceof NextResponse) return ownership;

    const body = await request.json();

    const existing = await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.date !== undefined) updates.date = body.date;
    if (body.action !== undefined) updates.action = body.action;
    if (body.quantity !== undefined) {
      updates.quantity = body.quantity;
      updates.adjustedQty = body.quantity * (existing[0].splitMultiplier || 1);
    }
    if (body.unitPriceAud !== undefined) updates.unitPriceAud = body.unitPriceAud;
    if (body.source !== undefined) updates.source = body.source;
    if (body.comment !== undefined) updates.comment = body.comment;

    // Recalculate totalAud if quantity or price changed
    const qty = (updates.quantity as number) ?? existing[0].quantity;
    const price = (updates.unitPriceAud as number) ?? existing[0].unitPriceAud;
    const action = (updates.action as string) ?? existing[0].action;
    updates.totalAud = action === 'BUY' ? qty * price : -(qty * price);

    await db.update(schema.transactions).set(updates).where(eq(schema.transactions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Transaction update error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const { txId } = await params;
    const id = parseInt(txId);

    const ownership = await requireTransactionOwnership(id, user.id);
    if (ownership instanceof NextResponse) return ownership;

    await db.delete(schema.transactions).where(eq(schema.transactions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Transaction delete error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
