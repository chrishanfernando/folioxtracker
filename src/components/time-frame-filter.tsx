'use client';

import { cn } from '@/lib/utils';

export type TimeFrame = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' | 'ALL';

const TIME_FRAMES: { key: TimeFrame; label: string }[] = [
  { key: '3M', label: '3M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
  { key: 'ALL', label: 'All' },
];

const EXTENDED_TIME_FRAMES: { key: TimeFrame; label: string }[] = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  ...TIME_FRAMES,
];

export function getStartDate(tf: TimeFrame): string | null {
  if (tf === 'ALL') return null;
  const now = new Date();
  if (tf === '1D') {
    now.setDate(now.getDate() - 1);
    return now.toISOString().split('T')[0];
  }
  if (tf === '1W') {
    now.setDate(now.getDate() - 7);
    return now.toISOString().split('T')[0];
  }
  if (tf === 'YTD') return `${now.getFullYear()}-01-01`;
  const months = tf === '1M' ? 1 : tf === '3M' ? 3 : tf === '1Y' ? 12 : 60;
  now.setMonth(now.getMonth() - months);
  return now.toISOString().split('T')[0];
}

export function filterByTimeFrame<T extends { date: string }>(data: T[], tf: TimeFrame): T[] {
  const start = getStartDate(tf);
  if (!start) return data;
  const inRange = data.filter(d => d.date >= start);
  // Include the last data point before the start date as an anchor
  const before = data.filter(d => d.date < start);
  if (before.length > 0 && (inRange.length === 0 || inRange[0].date > start)) {
    return [before[before.length - 1], ...inRange];
  }
  return inRange;
}

export function TimeFrameFilter({ value, onChange, extended }: { value: TimeFrame; onChange: (tf: TimeFrame) => void; extended?: boolean }) {
  const frames = extended ? EXTENDED_TIME_FRAMES : TIME_FRAMES;
  return (
    <div className="flex gap-1">
      {frames.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-2.5 py-1 text-xs rounded-md transition-colors',
            value === key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
