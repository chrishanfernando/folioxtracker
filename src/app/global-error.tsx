'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Replaces the root layout when it crashes, so it must render its own
// <html>/<body> and can't rely on globals.css or the theme provider.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '0 1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ color: '#666', maxWidth: '28rem', margin: 0 }}>
          An unexpected error occurred. Your portfolio data is safe.
          {error.digest ? ` Error reference: ${error.digest}` : ''}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            border: '1px solid #ccc',
            background: '#111',
            color: '#fff',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
