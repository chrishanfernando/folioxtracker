import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { hashPassword as scryptHash, verifyPassword as scryptVerify } from '@better-auth/utils/password';
import bcrypt from 'bcryptjs';
import { inArray, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { env } from '@/lib/env';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email';
import { track, EVENTS } from '@/lib/analytics';

function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

// Verifier that supports both Better Auth's default scrypt format AND bcrypt
// hashes inherited from the legacy single-password system. New passwords are
// always written with scrypt (via `hash`), so bcrypt support is read-only.
async function verifyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  return scryptVerify(hash, password);
}

async function hashPassword(password: string): Promise<string> {
  return scryptHash(password);
}

const baseURL = env.BETTER_AUTH_URL;

// Better Auth runs a CSRF origin check on every state-changing request that
// carries a cookie (e.g. sign-out), rejecting it with 403 INVALID_ORIGIN
// unless the browser's Origin header EXACTLY matches a trusted origin. A
// single configured URL is fragile: an apex-vs-www difference or a trailing
// slash on BETTER_AUTH_URL silently breaks logout for real users. Expand each
// configured URL to its normalised origin (which drops any trailing slash /
// path) plus its apex/www sibling so those common mismatches are tolerated.
function expandOrigin(value: string | undefined | null): string[] {
  if (!value) return [];
  try {
    const url = new URL(value);
    const portSuffix = url.port ? `:${url.port}` : '';
    const sibling = url.hostname.startsWith('www.')
      ? url.hostname.slice(4)
      : `www.${url.hostname}`;
    return [url.origin, `${url.protocol}//${sibling}${portSuffix}`];
  } catch {
    return [];
  }
}

// Origins always trusted for CSRF/redirect validation: the configured app
// URL(s) and their apex/www siblings, plus any explicit TRUSTED_ORIGINS entries
// (comma-separated env var) for additional domains.
const configuredTrustedOrigins = Array.from(new Set([
  ...expandOrigin(baseURL),
  ...expandOrigin(env.NEXT_PUBLIC_APP_URL),
  ...env.TRUSTED_ORIGINS,
]));

// In development, additionally trust the request's own origin if it's on a
// private LAN. This lets you test from another device on the same WiFi (e.g. a
// phone hitting http://192.168.x.x:3000) without hard-coding every machine's IP.
const isDev = !env.IS_PROD;
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
function resolveTrustedOrigins(request?: Request): string[] {
  const fixed = configuredTrustedOrigins;
  if (!isDev || !request) return fixed;
  const origin = request.headers.get('origin') || request.headers.get('referer');
  if (!origin) return fixed;
  try {
    const url = new URL(origin);
    if (PRIVATE_HOST_RE.test(url.hostname)) {
      return [...fixed, `${url.protocol}//${url.host}`];
    }
  } catch {
    // ignore
  }
  return fixed;
}

export const auth = betterAuth({
  baseURL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 10,
    password: { hash: hashPassword, verify: verifyPassword },
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      // Cascade portfolio data manually. The schema declares ON DELETE CASCADE
      // on profiles.user_id, but the actual SQLite migration added that column
      // via ALTER TABLE which dropped the cascade clause — so we must delete
      // profiles (and their children) explicitly before Better Auth attempts
      // the user delete, or it 500s on a FOREIGN KEY constraint failure.
      beforeDelete: async (user) => {
        const profileRows = await db
          .select({ id: schema.profiles.id })
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, user.id));
        const profileIds = profileRows.map(p => p.id);
        if (profileIds.length === 0) return;

        const assetRows = await db
          .select({ id: schema.assets.id })
          .from(schema.assets)
          .where(inArray(schema.assets.profileId, profileIds));
        const assetIds = assetRows.map(a => a.id);

        if (assetIds.length > 0) {
          await db.delete(schema.prices).where(inArray(schema.prices.assetId, assetIds));
          await db.delete(schema.transactions).where(inArray(schema.transactions.assetId, assetIds));
          await db.delete(schema.assets).where(inArray(schema.assets.id, assetIds));
        }
        await db.delete(schema.categoryTargets).where(inArray(schema.categoryTargets.profileId, profileIds));
        await db.delete(schema.cmcAccountMappings).where(inArray(schema.cmcAccountMappings.profileId, profileIds));
        await db.delete(schema.profiles).where(inArray(schema.profiles.id, profileIds));
      },
    },
  },
  // Product-analytics capture for the auth funnel. Guarded inside track() so a
  // failure here can never block a signup or login.
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await track(EVENTS.SIGNUP, { userId: createdUser.id });
        },
      },
    },
    session: {
      create: {
        after: async (createdSession) => {
          await track(EVENTS.LOGIN, { userId: createdSession.userId });
        },
      },
    },
  },
  trustedOrigins: resolveTrustedOrigins,
  // In-memory rate limiting. Single-instance only (loses state on cold start
  // and doesn't share across replicas) — acceptable at launch scale. Move to
  // Redis if we ever run multi-instance.
  rateLimit: {
    enabled: env.IS_PROD,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email':      { window: 60, max: 5 },
      '/sign-up/email':      { window: 60, max: 3 },
      '/forget-password':    { window: 300, max: 3 },
      '/reset-password':     { window: 300, max: 5 },
      '/send-verification-email': { window: 300, max: 3 },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
