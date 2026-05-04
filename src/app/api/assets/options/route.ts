import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { getProfileId } from '@/lib/profile';

export async function GET(request: NextRequest) {
  const profileId = getProfileId(request);

  const assets = await db.select({
    platform: schema.assets.platform,
    category: schema.assets.category,
  }).from(schema.assets).where(eq(schema.assets.profileId, profileId));

  const platforms = [...new Set(assets.map(a => a.platform).filter(Boolean))].sort();
  const categories = [...new Set(assets.map(a => a.category).filter(Boolean))].sort();

  return NextResponse.json({ platforms, categories });
}
