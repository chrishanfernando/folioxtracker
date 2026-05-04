/** Format YYYY-MM-DD to DD-MM-YYYY for display */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}-${m}-${y}`;
}
