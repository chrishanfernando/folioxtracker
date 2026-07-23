import { z } from 'zod';

const finiteNumber = z.number().refine(Number.isFinite, { message: 'must be a finite number' });

export const aud = finiteNumber.nonnegative();

export const qtyDecimal = finiteNumber.nonnegative();

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'must be ISO YYYY-MM-DD' });

export const transactionAction = z.enum(['BUY', 'SELL', 'DIVIDEND', 'SPLIT']);

export const positiveInt = z.coerce.number().int().positive();

export const assetIdRef = positiveInt;

export const sanitizedString = (maxLen: number) =>
  z.string().trim().min(1).max(maxLen);

export const optionalString = (maxLen: number) =>
  z.string().trim().max(maxLen).optional();

// Importer sources that can carry a per-profile ticker override.
export const importSource = z.enum(['stake', 'cmc', 'swyftx', 'ir', 'excel']);

// A user-supplied resolution of a broker's raw ticker to a canonical asset.
export const tickerOverrideSchema = z.object({
  source: importSource,
  sourceTicker: sanitizedString(32),
  symbol: sanitizedString(32),
  name: sanitizedString(128),
  displayTicker: sanitizedString(32),
  yahooSymbol: sanitizedString(32),
  category: sanitizedString(64),
}).strict();
