import Link from 'next/link';

export function LegalShell({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold">Portfolio Tracker</Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {lastUpdated}</p>
        <article className="prose prose-sm dark:prose-invert max-w-none space-y-4 leading-relaxed">
          {children}
        </article>
      </main>
      <footer className="border-t mt-10">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground">
          <Link href="/login" className="underline">Back to sign in</Link>
        </div>
      </footer>
    </div>
  );
}
