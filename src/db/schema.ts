import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default('2024-01-01'),
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


export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  passwordHash: text('password_hash').notNull(),
  email: text('email'),
  emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(false),
  lastPriceFetch: text('last_price_fetch'),
  lastRebalanceCheck: text('last_rebalance_check'),
  lastEmailPoll: text('last_email_poll'),
});

export const cmcAccountMappings = sqliteTable('cmc_account_mappings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cmcAccountNumber: text('cmc_account_number').notNull().unique(),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  label: text('label'),
});
