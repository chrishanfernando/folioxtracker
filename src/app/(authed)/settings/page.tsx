'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { signOut } from '@/lib/auth-client';

interface CmcMapping {
  id: number;
  cmcAccountNumber: string;
  profileId: number;
  label: string | null;
}

interface Profile {
  id: number;
  name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [lastPriceFetch, setLastPriceFetch] = useState('');
  const [lastRebalanceCheck, setLastRebalanceCheck] = useState('');
  const [lastEmailPoll, setLastEmailPoll] = useState('');

  // CMC account mappings
  const [mappings, setMappings] = useState<CmcMapping[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newProfileId, setNewProfileId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data) => {
        setEmail(data.notificationEmail || '');
        setEmailNotifications(data.emailNotifications || false);
        setAccountEmail(data.accountEmail || '');
        setLastPriceFetch(data.lastPriceFetch || '');
        setLastRebalanceCheck(data.lastRebalanceCheck || '');
        setLastEmailPoll(data.lastEmailPoll || '');
      });
    loadMappings();
  }, []);

  async function loadMappings() {
    const res = await fetch('/api/settings/cmc-accounts');
    const data = await res.json();
    setMappings(data.mappings || []);
    setProfiles(data.profiles || []);
    if (!newProfileId && data.profiles?.length > 0) {
      setNewProfileId(String(data.profiles[0].id));
    }
  }

  async function addMapping() {
    if (!newAccountNumber.trim() || !newProfileId) return;
    const res = await fetch('/api/settings/cmc-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountNumber: newAccountNumber.trim(),
        profileId: parseInt(newProfileId),
        label: newLabel.trim() || null,
      }),
    });
    if (res.ok) {
      toast.success('Account mapping added');
      setNewAccountNumber('');
      setNewLabel('');
      await loadMappings();
    }
  }

  async function deleteMapping(id: number) {
    await fetch('/api/settings/cmc-accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    toast.success('Mapping removed');
    await loadMappings();
  }

  async function pollNow() {
    setPolling(true);
    try {
      const res = await fetch('/api/cron/email', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Polled: ${data.imported} imported, ${data.skipped} skipped`);
        if (data.errors?.length > 0) {
          data.errors.forEach((e: string) => toast.error(e));
        }
        setLastEmailPoll(new Date().toISOString());
      } else {
        toast.error(data.error || 'Poll failed');
      }
    } catch {
      toast.error('Failed to poll');
    } finally {
      setPolling(false);
    }
  }

  async function saveSettings() {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationEmail: email, emailNotifications }),
    });

    if (res.ok) {
      toast.success('Settings saved');
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to save');
    }
  }

  async function logout() {
    await signOut();
    router.push('/login');
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as {accountEmail || '…'}.</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>Receive alerts when portfolio allocation drifts beyond thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Notification email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={accountEmail || 'you@example.com'} />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to use your account email ({accountEmail}).</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="notifications"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="notifications">Enable email notifications</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CMC Account Mappings</CardTitle>
            <CardDescription>Map CMC Markets account numbers to profiles for auto-importing email confirmations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mappings.length > 0 && (
              <div className="space-y-2">
                {mappings.map(m => {
                  const profile = profiles.find(p => p.id === m.profileId);
                  return (
                    <div key={m.id} className="flex items-center justify-between text-sm p-2 rounded bg-accent/30">
                      <div>
                        <span className="font-mono">{m.cmcAccountNumber}</span>
                        <span className="text-muted-foreground mx-2">&rarr;</span>
                        <span className="font-medium">{profile?.name || `Profile ${m.profileId}`}</span>
                        {m.label && <span className="text-muted-foreground ml-2">({m.label})</span>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMapping(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input
                  value={newAccountNumber}
                  onChange={e => setNewAccountNumber(e.target.value)}
                  placeholder="e.g. 36907221"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Profile</Label>
                <select
                  value={newProfileId}
                  onChange={e => setNewProfileId(e.target.value)}
                  className="h-8 w-full rounded border bg-background px-2 text-sm"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" className="h-8" onClick={addMapping} disabled={!newAccountNumber.trim()}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>To change your password, sign out and use the &quot;Forgot password&quot; flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password" className="text-sm underline">Send password reset email</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Last price fetch: {lastPriceFetch || 'Never'}</p>
            <p>Last rebalance check: {lastRebalanceCheck || 'Never'}</p>
            <div className="flex items-center gap-2">
              <p>Last email poll: {lastEmailPoll || 'Never'}</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={pollNow} disabled={polling}>
                {polling ? 'Polling...' : 'Poll Now'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={saveSettings}>Save Settings</Button>
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>
      </div>
    </AppShell>
  );
}
