'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { signIn, signUp } from '@/lib/auth-client';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signUp.email({ email, password, name });
    setLoading(false);

    if (result.error) {
      setError(result.error.message || 'Sign-up failed');
      return;
    }
    setSubmitted(true);
  }

  async function handleGoogle() {
    setLoading(true);
    setError('');
    await signIn.social({ provider: 'google', callbackURL: '/dashboard' });
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to <span className="font-medium">{email}</span>. Click it to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive it? Check spam, or <Link href="/signup" className="underline">try again</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Track your investments across stocks and crypto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            Sign up with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <p className="text-xs text-muted-foreground mt-1">At least 10 characters.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !name || !email || password.length < 10}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="underline">Terms</Link>,{' '}
            <Link href="/privacy" className="underline">Privacy Policy</Link>, and{' '}
            <Link href="/disclaimer" className="underline">Disclaimer</Link>.
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
