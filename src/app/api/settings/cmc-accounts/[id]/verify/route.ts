import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import * as pdfParse from 'pdf-parse';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth-helpers';
import { apiError, AppError, NotFoundError, ValidationError } from '@/lib/api-error';
import { env } from '@/lib/env';

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${PARSE_TIMEOUT_MS}ms`)),
      PARSE_TIMEOUT_MS,
    );
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!env.EMAIL_POLL_ENABLED) {
      return NextResponse.json({ error: 'Feature disabled' }, { status: 503 });
    }

    const user = await requireUser();
    if (user instanceof NextResponse) return user;

    const { id: idParam } = await context.params;
    const mappingId = Number(idParam);
    if (!Number.isInteger(mappingId) || mappingId <= 0) {
      throw new ValidationError([{ path: 'id', message: 'Must be a positive integer' }]);
    }

    const rows = await db.select({
      id: schema.cmcAccountMappings.id,
      cmcAccountNumber: schema.cmcAccountMappings.cmcAccountNumber,
      profileId: schema.cmcAccountMappings.profileId,
      ownerUserId: schema.profiles.userId,
    })
      .from(schema.cmcAccountMappings)
      .innerJoin(schema.profiles, eq(schema.cmcAccountMappings.profileId, schema.profiles.id))
      .where(eq(schema.cmcAccountMappings.id, mappingId))
      .limit(1);

    if (rows.length === 0 || rows[0].ownerUserId !== user.id) {
      throw new NotFoundError('Mapping not found');
    }
    const mapping = rows[0];

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      throw new ValidationError([{ path: '(root)', message: 'multipart/form-data required' }]);
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError([{ path: 'file', message: 'PDF file required' }]);
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    type PdfParseFn = (b: Buffer) => Promise<{ text: string }>;
    const pdf = ((pdfParse as unknown as { default?: PdfParseFn }).default ||
      (pdfParse as unknown as PdfParseFn));
    let pdfData: { text: string };
    try {
      pdfData = await withTimeout(pdf(buffer), 'pdf-parse');
    } catch {
      throw new AppError(400, 'Could not parse PDF');
    }

    const match = pdfData.text.match(/(?:Account|A\/C)\s*(?:No\.?|Number)?\s*:?\s*(\d{6,})/i);
    const accountInPdf = match?.[1] ?? '';

    if (!accountInPdf || accountInPdf !== mapping.cmcAccountNumber) {
      throw new AppError(400, 'Account number in PDF does not match mapping');
    }

    await db.update(schema.cmcAccountMappings)
      .set({ verified: true })
      .where(and(
        eq(schema.cmcAccountMappings.id, mapping.id),
        eq(schema.cmcAccountMappings.profileId, mapping.profileId),
      ));

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    return apiError(error, { route: '/api/settings/cmc-accounts/[id]/verify', method: 'POST' });
  }
}
