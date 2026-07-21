'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Info, X } from 'lucide-react';

type Variant = 'inline' | 'compact';

const STORAGE_KEY = 'general-advice-banner-dismissed';

export function GeneralAdviceBanner({ variant = 'inline' }: { variant?: Variant }) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(STORAGE_KEY) === '1') setDismissed(true);
  }, []);

  if (!mounted || dismissed) return null;

  function close() {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  }

  if (variant === 'compact') {
    return (
      <div className="text-xs text-muted-foreground border border-dashed rounded-md px-3 py-2 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          General information only — not personal financial advice. See{' '}
          <Link href="/disclaimer" className="underline">disclaimer</Link>.
        </span>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
      <div className="flex-1 text-sm leading-relaxed">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          General information, not personal financial advice
        </p>
        <p className="text-muted-foreground mt-1">
          Portfolios shown here are general educational examples. They do not
          account for your objectives, financial situation, or needs. Before
          acting on anything you see, consider speaking with a licensed financial
          adviser and reading the relevant Product Disclosure Statement. See our{' '}
          <Link href="/disclaimer" className="underline">disclaimer</Link>.
        </p>
      </div>
      <button
        onClick={close}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
