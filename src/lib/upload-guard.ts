import { NextResponse } from 'next/server';

/**
 * Import files are buffered fully into memory before parsing, so cap the size
 * to keep a single request from exhausting the small deploy target. Real
 * broker exports are well under 1 MB; 10 MB leaves generous headroom.
 */
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Extract and validate an uploaded file from multipart form data. Returns the
 * File, or a 400/413 NextResponse when missing, not a file, empty, or too
 * large. Usage mirrors requireUser:
 *
 *   const file = requireUploadFile(formData);
 *   if (file instanceof NextResponse) return file;
 */
export function requireUploadFile(
  formData: FormData,
  field = 'file',
  maxBytes = MAX_IMPORT_FILE_BYTES,
): File | NextResponse {
  const value = formData.get(field);
  if (!(value instanceof File) || value.size === 0) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (value.size > maxBytes) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${Math.floor(maxBytes / (1024 * 1024))} MB.` },
      { status: 413 },
    );
  }
  return value;
}
