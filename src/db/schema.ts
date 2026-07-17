import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// Better Auth tables (user, session, account, verification).
// Names match Better Auth's defaults so the drizzleAdapter resolves them by convention.
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// Per-user notification preferences (separate from auth-managed user table).
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  notificationEmail: text('notification_email'),
  emailNotifications: integer('email_notifications', { mode: 'boolean' }).notNull().default(false),
  // When true, this user's behaviour is excluded from product analytics capture.
  // Default false = analytics on (first-party, no PII — see src/lib/analytics.ts).
  analyticsOptOut: integer('analytics_opt_out', { mode: 'boolean' }).notNull().default(false),
});

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  benchmarkSymbol: text('benchmark_symbol').default('VAS.AX'),
  createdAt: text('created_at').notNull().default('2024-01-01'),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
});

export const assets = sqliteTable('assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profiles.id).default(1),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  displayTicker: text('display_ticker').notNull(),
  yahooSymbol: text('yahoo_symbol').notNull(),
  category: text('category').notNull(),
  platform: text('platform'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assetId: integer('asset_id').notNull().references(() => assets.id),
  date: text('date').notNull(),
  action: text('action').notNull(),
  quantity: real('quantity').notNull(),
  unitPriceLocal: real('unit_price_local'),
  localCurrency: text('local_currency'),
  fxRate: real('fx_rate'),
  unitPriceAud: real('unit_price_aud').notNull(),
  splitMultiplier: real('split_multiplier').default(1),
  adjustedQty: real('adjusted_qty').notNull(),
  totalAud: real('total_aud').notNull(),
  source: text('source'),
  comment: text('comment'),
});

export const prices = sqliteTable('prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  assetId: integer('asset_id').notNull().references(() => assets.id),
  date: text('date').notNull(),
  priceAud: real('price_aud').notNull(),
  priceUsd: real('price_usd'),
  fxRate: real('fx_rate'),
}, (table) => [
  uniqueIndex('price_asset_date_idx').on(table.assetId, table.date),
]);

export const categoryTargets = sqliteTable('category_targets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profiles.id).default(1),
  category: text('category').notNull(),
  targetPct: real('target_pct').notNull(),
  threshold: real('threshold').notNull().default(5),
});


// Global app-level settings (one row, id=1). Per-user settings live in `userSettings`.
// `passwordHash`, `email`, and `emailNotifications` are retained as nullable for
// backwards-compat with the legacy single-password schema; they are no longer read.
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  passwordHash: text('password_hash'),
  email: text('email'),
  emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(false),
});

// Last-run state per cron job. One row per job_name (e.g. 'prices',
// 'prices_backfill', 'rebalance', 'email_poll'). last_summary is a JSON blob.
export const cronRuns = sqliteTable('cron_runs', {
  jobName: text('job_name').primaryKey(),
  lastRunAt: text('last_run_at').notNull(),
  lastStatus: text('last_status').notNull(),
  lastSummary: text('last_summary'),
});

export const riskProfiles = sqliteTable('risk_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  riskScore: integer('risk_score').notNull(),
  riskTier: text('risk_tier').notNull(),
  answers: text('answers').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// First-party product-analytics event stream. Privacy-preserving by construction:
// no dollar amounts (portfolio value is bucketed before it gets here), no holdings,
// no free text. `userId` is the opaque Better Auth id, kept so per-user feature
// adoption can be computed; it is never shown un-aggregated in the admin view.
// Acquisition/activation/retention are derived from the `user`/`session` tables
// directly (see src/lib/metrics.ts); this table covers in-app feature usage.
export const analyticsEvents = sqliteTable('analytics_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Nullable: pre-auth events (e.g. signup funnel) may not have a user yet.
  userId: text('user_id'),
  name: text('name').notNull(),
  // JSON blob of bucketed/enumerated properties (e.g. {"source":"cmc","inserted":12}).
  props: text('props'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('analytics_events_name_created_idx').on(table.name, table.createdAt),
  index('analytics_events_user_idx').on(table.userId),
]);

export const cmcAccountMappings = sqliteTable('cmc_account_mappings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cmcAccountNumber: text('cmc_account_number').notNull().unique(),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  label: text('label'),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
});
