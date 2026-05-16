import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { hashPassword as scryptHash, verifyPassword as scryptVerify } from '@better-auth/utils/password';
import bcrypt from 'bcryptjs';
import { inArray, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email';

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

const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// In development, trust the request's own origin if it's on a private LAN.
// This lets you test from another device on the same WiFi (e.g. phone hitting
// http://192.168.x.x:3000) without hard-coding every machine's IP.
// In production, only the configured baseURL is trusted.
const isDev = process.env.NODE_ENV !== 'production';
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
function resolveTrustedOrigins(request?: Request): string[] {
  const fixed = [baseURL];
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
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production',
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 8,
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
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
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
  trustedOrigins: resolveTrustedOrigins,
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
