import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/disclaimer',
  '/api/auth',
  '/api/cron',
  '/api/health',
  // Sentry tunnel (next.config.ts `tunnelRoute`) — client error envelopes POST
  // here to dodge ad/privacy blockers. Must stay public so logged-out users'
  // errors (landing/login/signup) still report instead of 307-ing to /login.
  '/monitoring',
];

function isPublicPath(pathname: string): boolean {
  // Landing page — public. The page itself redirects authed users to /dashboard.
  if (pathname === '/') return true;
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Lightweight cookie presence check; full session is verified by API handlers
  // and Better Auth on each authenticated request.
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authenticated responses hold personal financial data. Mark them no-store so
  // the browser (and any intermediary) never caches or restores them from
  // bfcache — otherwise a logged-out user can still be shown their previously
  // rendered dashboard by navigating back or re-entering the URL.
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, must-revalidate');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
