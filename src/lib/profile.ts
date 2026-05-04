import { NextRequest } from 'next/server';

/** Extract profileId from request header or query param. Defaults to 1. */
export function getProfileId(request: NextRequest): number {
  const fromHeader = request.headers.get('x-profile-id');
  if (fromHeader) return parseInt(fromHeader) || 1;
  const fromQuery = request.nextUrl.searchParams.get('profileId');
  if (fromQuery) return parseInt(fromQuery) || 1;
  return 1;
}
