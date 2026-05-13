'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sendVerificationEmail } from '@/lib/auth-client';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [email] = useState(() =>
    typeof window === 'undefined' ? '' : window.localStorage.getItem('pendingVerifyEmail') || ''
  );

  async function resend() {
    if (!email) return;
    const result = await sendVerificationEmail({ email, callbackURL: '/login?verified=1' });
    setStatus(result.error ? 'error' : 'sent');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            Click the link we sent to {email || 'your inbox'} to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {email && (
            <Button variant="outline" className="w-full" onClick={resend}>
              Resend verification email
            </Button>
          )}
          {status === 'sent' && <p className="text-sm text-emerald-600">Sent. Check your inbox.</p>}
          {status === 'error' && <p className="text-sm text-destructive">Could not resend right now.</p>}
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
