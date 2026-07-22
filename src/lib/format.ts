/** Format YYYY-MM-DD to DD-MM-YYYY for display */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}-${m}-${y}`;
}

/**
 * Semantic gain/loss text colour for a signed number. Uses the theme-aware
 * `--gain`/`--loss` tokens (see globals.css) so profit/loss reads correctly in
 * every theme, rather than hardcoded `text-green-500`/`text-red-500`.
 * Zero is treated as a gain (non-negative).
 */
export function plClass(n: number): string {
  return n >= 0 ? 'text-gain' : 'text-loss';
}

/** Whole-dollar AUD, no decimals: 12345.6 → "$12,346". */
export function formatAud(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Signed one-decimal percentage: 3.2 → "3.2%". */
export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

/** Share/unit quantity: whole numbers stay whole, else up to `digits` places. */
export function formatQty(n: number, digits = 3): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(digits);
}
