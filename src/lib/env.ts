import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const NODE_ENV = (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production';
// Next.js evaluates server modules during `next build` to collect page data.
// Real runtime secrets aren't available there (the build container is
// intentionally minimal), so skip strict prod validation in that phase only.
// At server start (`next start`) the phase is 'phase-production-server' and
// strict validation runs normally.
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
const IS_PROD = NODE_ENV === 'production' && !IS_BUILD;

const nonEmpty = z.string().min(1);

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_AUTH_TOKEN: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().min(1).optional(),
  EMAIL_UNSUBSCRIBE_MAILTO: z.string().min(1).optional(),
  EMAIL_POLL_ENABLED: z.enum(['true', 'false']).default('false'),
  IMAP_HOST: z.string().min(1).optional(),
  IMAP_PORT: z.coerce.number().int().positive().default(993),
  IMAP_USER: z.string().min(1).optional(),
  IMAP_PASSWORD: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  // Comma-separated list of emails allowed to view the internal /admin/metrics
  // dashboard. Empty = nobody can reach it (deny by default).
  ADMIN_EMAILS: z.string().optional(),
});

const productionRequired = z.object({
  BETTER_AUTH_SECRET: nonEmpty,
  CRON_SECRET: nonEmpty,
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: nonEmpty,
  EMAIL_FROM: nonEmpty,
  GOOGLE_CLIENT_ID: nonEmpty,
  GOOGLE_CLIENT_SECRET: nonEmpty,
});

export class EnvValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Environment validation failed:\n${issues.map(i => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function parseEnv() {
  const base = baseSchema.safeParse(process.env);
  if (!base.success) {
    const issues = base.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new EnvValidationError(issues);
  }

  const parsed = base.data;

  if (IS_PROD) {
    const prodCheck = productionRequired.safeParse(parsed);
    if (!prodCheck.success) {
      const issues = prodCheck.error.issues.map(i => `${i.path.join('.')}: required in production (got "${String(process.env[i.path[0] as string] ?? '')}")`);
      throw new EnvValidationError(issues);
    }

    if (/(^|\.)resend\.dev$/i.test(parsed.EMAIL_FROM ?? '') || /resend\.dev[>\s]?/i.test(parsed.EMAIL_FROM ?? '')) {
      throw new EnvValidationError([
        'EMAIL_FROM: must use a verified production sender domain, not a *.resend.dev sandbox address',
      ]);
    }
  }

  // Dev convenience: generate a per-process secret if missing so the dev server still boots.
  // Note this is regenerated on every restart, which invalidates existing sessions — intentional,
  // surfaces the missing config immediately.
  let betterAuthSecret = parsed.BETTER_AUTH_SECRET ?? parsed.JWT_SECRET;
  if (!betterAuthSecret) {
    if (IS_PROD) {
      // Already caught above, but defence-in-depth.
      throw new EnvValidationError(['BETTER_AUTH_SECRET: required in production']);
    }
    betterAuthSecret = randomBytes(32).toString('hex');
    console.warn(
      '[env] BETTER_AUTH_SECRET is not set. Using a randomly generated value for this process. ' +
      'Existing sessions will be invalidated on restart. Set BETTER_AUTH_SECRET in .env to persist.'
    );
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    IS_PROD,
    DATABASE_URL: parsed.DATABASE_URL,
    DATABASE_AUTH_TOKEN: parsed.DATABASE_AUTH_TOKEN,
    BETTER_AUTH_URL: parsed.BETTER_AUTH_URL ?? parsed.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    NEXT_PUBLIC_APP_URL: parsed.NEXT_PUBLIC_APP_URL,
    BETTER_AUTH_SECRET: betterAuthSecret,
    CRON_SECRET: parsed.CRON_SECRET,
    GOOGLE_CLIENT_ID: parsed.GOOGLE_CLIENT_ID ?? '',
    GOOGLE_CLIENT_SECRET: parsed.GOOGLE_CLIENT_SECRET ?? '',
    RESEND_API_KEY: parsed.RESEND_API_KEY,
    EMAIL_FROM: parsed.EMAIL_FROM,
    EMAIL_REPLY_TO: parsed.EMAIL_REPLY_TO,
    EMAIL_UNSUBSCRIBE_MAILTO: parsed.EMAIL_UNSUBSCRIBE_MAILTO,
    EMAIL_POLL_ENABLED: parsed.EMAIL_POLL_ENABLED === 'true',
    IMAP_HOST: parsed.IMAP_HOST,
    IMAP_PORT: parsed.IMAP_PORT,
    IMAP_USER: parsed.IMAP_USER,
    IMAP_PASSWORD: parsed.IMAP_PASSWORD,
    SENTRY_DSN: parsed.SENTRY_DSN,
    ADMIN_EMAILS: (parsed.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  } as const;
}

export const env = parseEnv();
export type Env = typeof env;
