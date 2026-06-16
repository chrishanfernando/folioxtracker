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
