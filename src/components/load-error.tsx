'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Shared load-failure state with a retry action. Distinguishes a fetch error
 * from an empty result — collapsing the two reads as data loss in a finance
 * app. Mirrors the dashboard's reference error card.
 */
export function LoadError({
  title = "Couldn't load your data",
  message = 'Something went wrong fetching your portfolio. Your data is safe — try again.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-semibold mb-2">{title}</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">{message}</p>
        <Button onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </CardContent>
    </Card>
  );
}
