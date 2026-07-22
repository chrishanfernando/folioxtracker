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
