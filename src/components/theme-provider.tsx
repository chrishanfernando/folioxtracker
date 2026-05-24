'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      themes={['dark', 'light', 'pastel-rose', 'pastel-sky', 'pastel-sage']}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
