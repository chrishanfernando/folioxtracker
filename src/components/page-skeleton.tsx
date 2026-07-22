import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading placeholders that reserve layout space (avoiding CLS) in place of a
 * bare "Loading…" text. `variant` picks the dominant shape of the page.
 */
export function PageSkeleton({
  variant = 'cards',
  cards = 4,
  rows = 6,
}: {
  variant?: 'cards' | 'table';
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="animate-in fade-in-0">
      <Skeleton className="h-8 w-40 mb-6" />
      {variant === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-4 space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
