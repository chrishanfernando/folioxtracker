'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { signIn } from '@/lib/auth-client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(params.get('verified') === '1' ? 'Email verified — you can sign in now.' : '');
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    const result = await signIn.email({ email, password, callbackURL: '/dashboard' });
    setLoading(false);

    if (result.error) {
      const code = result.error.code;
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email before signing in. Check your inbox for the verification link.');
        return;
      }
      setError(result.error.message || 'Sign-in failed');
      return;
    }
    router.push('/dashboard');
  }

  async function handleGoogle() {
    setLoading(true);
    setError('');
    await signIn.social({ provider: 'google', callbackURL: '/dashboard' });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>Welcome back to FolioX Tracker.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground underline">Forgot?</Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {info && <p className="text-sm text-emerald-600">{info}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !email || !password}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-foreground underline">Sign up</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-xs text-muted-foreground">
        <Link href="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
      </p>
    </div>
  );
}
