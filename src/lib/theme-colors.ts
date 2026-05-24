'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export interface ThemeChartColors {
  pieColors: string[];
  gridColor: string;
  refAreaColor: string;
  lineColors: {
    value: string;
    cost: string;
    benchmark: string;
  };
}

const THEME_CHART_COLORS: Record<string, ThemeChartColors> = {
  dark: {
    pieColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
    gridColor: '#2a2a2a',
    refAreaColor: '#3b82f6',
    lineColors: { value: '#3b82f6', cost: '#666', benchmark: '#f59e0b' },
  },
  light: {
    pieColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'],
    gridColor: '#e5e7eb',
    refAreaColor: '#3b82f6',
    lineColors: { value: '#3b82f6', cost: '#aaa', benchmark: '#f59e0b' },
  },
  'pastel-rose': {
    pieColors: ['#d95f8e', '#9b6fc4', '#d98c45', '#5cb87a', '#5b9bd5', '#d96a5a', '#45b5ab'],
    gridColor: '#eecdd8',
    refAreaColor: '#d95f8e',
    lineColors: { value: '#d95f8e', cost: '#c9a4b2', benchmark: '#d98c45' },
  },
  'pastel-sky': {
    pieColors: ['#4a8fcc', '#43a89a', '#cc9a50', '#b06aab', '#6ab55e', '#cc6868', '#6a8ed6'],
    gridColor: '#c8d8ec',
    refAreaColor: '#4a8fcc',
    lineColors: { value: '#4a8fcc', cost: '#9ab4cc', benchmark: '#cc9a50' },
  },
  'pastel-sage': {
    pieColors: ['#4a9262', '#4a7eb5', '#b8923a', '#8a52ab', '#b85252', '#52b5ab', '#9aaa48'],
    gridColor: '#c5ddc9',
    refAreaColor: '#4a9262',
    lineColors: { value: '#4a9262', cost: '#9ab5a0', benchmark: '#b8923a' },
  },
};

const FALLBACK = THEME_CHART_COLORS.dark;

export function useChartColors(): ThemeChartColors {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return FALLBACK;
  return THEME_CHART_COLORS[resolvedTheme ?? 'dark'] ?? FALLBACK;
}
