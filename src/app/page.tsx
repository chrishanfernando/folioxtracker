import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Upload,
  Target,
  LineChart,
  ShieldCheck,
  Wallet,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { getSessionUser } from '@/lib/auth-helpers';

export const metadata = {
  title: 'FolioX Tracker — Track your Australian investment portfolio',
  description:
    'Aggregate your CMC, Stake, Swyftx and Independent Reserve holdings. AUD-normalised. Daily prices. Rebalance targets. Built for Australian DIY investors.',
};

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <Features />
      <ImportsStrip />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg">
          FolioX Tracker
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 font-medium hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground mb-6">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Built for Australian DIY investors
      </div>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.05]">
        Your whole portfolio,
        <br />
        <span className="text-muted-foreground">in one Australian dollar view.</span>
      </h1>
      <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
        Aggregate holdings across CMC Markets, Stake, Swyftx, and Independent
        Reserve. Get daily prices, drift alerts, and rebalance targets — without
        a spreadsheet.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-3 font-medium hover:opacity-90"
        >
          Start free <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/login"
          className="rounded-md border px-5 py-3 font-medium hover:bg-accent"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        No credit card. General information only — not financial advice.
      </p>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Wallet,
      title: 'Multi-platform, AUD-normalised',
      body: 'Every buy, sell, dividend, and split — converted to AUD with FX context preserved.',
    },
    {
      icon: LineChart,
      title: 'Daily prices from Yahoo',
      body: 'Automatic price refresh with multi-year backfill on demand. No API key needed.',
    },
    {
      icon: Target,
      title: 'Category targets + drift',
      body: 'Set target % per category. See drift live. Buy-only recommendations to rebalance.',
    },
    {
      icon: Upload,
      title: 'Import from your broker',
      body: 'CSV and XLSX from CMC, Stake, Swyftx, IR. Or auto-import CMC email confirmations via IMAP.',
    },
    {
      icon: BarChart3,
      title: 'Multiple portfolios',
      body: 'Keep super, personal, and family portfolios separate — one login, switch with a click.',
    },
    {
      icon: ShieldCheck,
      title: 'Your data, your control',
      body: 'Self-hostable. Export anytime. Delete anytime. No ads, no third-party tracking.',
    },
  ];
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-2">
          Everything you need to run your portfolio like a fund
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          The features you&apos;d otherwise piece together from four spreadsheets and a broker terminal.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((f) => (
            <div key={f.title} className="rounded-lg border p-6">
              <f.icon className="h-5 w-5 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ImportsStrip() {
  const brokers = ['CMC Markets', 'Stake', 'Swyftx', 'Independent Reserve'];
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-14 text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
          Native imports for
        </p>
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-lg font-medium">
          {brokers.map((b) => (
            <span key={b}>{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-3">Stop reconciling brokers by hand</h2>
        <p className="text-muted-foreground mb-8">
          Sign up in under a minute. Import your first CSV. See your real
          allocation drift immediately.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-5 py-3 font-medium hover:opacity-90"
        >
          Create a free account <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} FolioX Tracker. All rights reserved.</p>
        <nav className="flex items-center gap-5">
          <Link href="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <a
            href="mailto:hello@folioxtracker.com"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" /> Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
