import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { hashPassword as scryptHash, verifyPassword as scryptVerify } from '@better-auth/utils/password';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
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
  trustedOrigins: [baseURL],
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
