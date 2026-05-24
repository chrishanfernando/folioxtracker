'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ThemeOption {
  id: string;
  label: string;
  description: string;
  preview: {
    bg: string;
    sidebar: string;
    card: string;
    text: string;
    accent: string;
  };
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'Default dark theme',
    preview: { bg: '#1a1a1a', sidebar: '#1e1e1e', card: '#252525', text: '#f5f5f5', accent: '#3b82f6' },
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Clean light theme',
    preview: { bg: '#f5f5f5', sidebar: '#fafafa', card: '#ffffff', text: '#1a1a1a', accent: '#3b82f6' },
  },
  {
    id: 'pastel-rose',
    label: 'Pastel Rose',
    description: 'Soft pink & mauve tones',
    preview: { bg: '#fdf5f7', sidebar: '#f8eef2', card: '#fff8fa', text: '#2a1820', accent: '#d95f8e' },
  },
  {
    id: 'pastel-sky',
    label: 'Pastel Sky',
    description: 'Soft blue & lavender tones',
    preview: { bg: '#f5f8fd', sidebar: '#eef3fa', card: '#f8fbff', text: '#18202a', accent: '#4a8fcc' },
  },
  {
    id: 'pastel-sage',
    label: 'Pastel Sage',
    description: 'Soft green & mint tones',
    preview: { bg: '#f5faf6', sidebar: '#eef5ef', card: '#f8fff8', text: '#182018', accent: '#4a9262' },
  },
];

function ThemePreview({ option, active }: { option: ThemeOption; active: boolean }) {
  const { bg, sidebar, card, text, accent } = option.preview;
  return (
    <div
      className={cn(
        'relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all hover:scale-[1.02]',
        active ? 'border-primary shadow-md' : 'border-border hover:border-muted-foreground/50'
      )}
      style={{ background: bg }}
    >
      <div className="flex h-20">
        {/* Sidebar strip */}
        <div className="w-10 h-full flex flex-col gap-1 p-1.5" style={{ background: sidebar }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-sm h-1.5 w-full opacity-50" style={{ background: i === 0 ? accent : text, opacity: i === 0 ? 0.8 : 0.2 }} />
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 p-2 flex flex-col gap-1.5">
          <div className="rounded h-1.5 w-3/4" style={{ background: text, opacity: 0.6 }} />
          <div className="flex gap-1.5 flex-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex-1 rounded h-full" style={{ background: card, border: `1px solid ${text}18` }}>
                <div className="m-1 rounded h-1" style={{ background: accent, opacity: 0.7 - i * 0.15 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {active && (
        <div className="absolute top-1 right-1 rounded-full p-0.5" style={{ background: accent }}>
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </div>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEME_OPTIONS.map(opt => (
          <div key={opt.id} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEME_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            className="text-left space-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <ThemePreview option={opt} active={theme === opt.id} />
            <div>
              <p className="text-sm font-medium leading-none">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
