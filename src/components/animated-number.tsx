'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: string;
  className?: string;
}

function parseNumeric(s: string): number {
  return parseFloat(s.replace(/[^0-9.\-]/g, '')) || 0;
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const prevValue = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const prev = prevValue.current;
    prevValue.current = value;

    if (prev === value) return;

    const prevNum = parseNumeric(prev);
    const currNum = parseNumeric(value);

    if (currNum !== prevNum) {
      setFlash(currNum > prevNum ? 'up' : 'down');
      const timer = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span
      className={cn(
        'tabular-nums transition-colors duration-500',
        flash === 'up' && 'text-gain',
        flash === 'down' && 'text-loss',
        className,
      )}
    >
      {value}
    </span>
  );
}
