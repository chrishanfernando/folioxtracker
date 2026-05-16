'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, List, ArrowLeftRight, Target, Upload, Settings, Plus, ChevronDown, Pencil, LineChart, Brain, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/components/profile-context';
import { useState } from 'react';
import { toast } from 'sonner';
import { signOut } from '@/lib/auth-client';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/holdings', label: 'Holdings', icon: List },
  { href: '/charts', label: 'Charts', icon: LineChart },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/rebalance', label: 'Rebalance', icon: Target },
  { href: '/risk-profile', label: 'Risk Profile', icon: Brain },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profiles, activeProfileId, activeProfile, setActiveProfileId, refreshProfiles } = useProfile();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      router.push('/login');
    } catch {
      toast.error('Failed to log out');
      setLoggingOut(false);
    }
  }

  async function renameProfile() {
    if (!renamingId || !renameText.trim()) return;
    await fetch('/api/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: renamingId, name: renameText.trim() }),
    });
    await refreshProfiles();
    setRenamingId(null);
    toast.success('Profile renamed');
  }

  async function createProfile() {
    if (!newProfileName.trim()) return;
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProfileName.trim() }),
    });
    const profile = await res.json();
    if (profile.id) {
      await refreshProfiles();
      setActiveProfileId(profile.id);
      setNewProfileName('');
      setShowNewProfile(false);
      setShowProfileMenu(false);
      toast.success(`Profile "${profile.name}" created`);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col border-r">
        <div className="flex flex-col flex-1 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 mb-2">
            <h1 className="text-lg font-semibold">Portfolio Tracker</h1>
          </div>

          {/* Profile Selector */}
          <div className="px-3 mb-4 relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md bg-accent/50 hover:bg-accent transition-colors"
            >
              <span className="truncate font-medium">{activeProfile?.name || 'Select Profile'}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-2" />
            </button>
            {showProfileMenu && (
              <div className="absolute z-50 top-full left-3 right-3 mt-1 bg-popover border rounded-md shadow-lg py-1">
                {profiles.map(p => (
                  renamingId === p.id ? (
                    <div key={p.id} className="px-3 py-1.5 flex gap-1">
                      <input
                        value={renameText}
                        onChange={e => setRenameText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameProfile(); if (e.key === 'Escape') setRenamingId(null); }}
                        className="flex-1 text-sm bg-transparent border rounded px-2 py-1 outline-none focus:ring-1 ring-primary"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div key={p.id} className="flex items-center group">
                      <button
                        onClick={() => { setActiveProfileId(p.id); setShowProfileMenu(false); }}
                        className={cn(
                          'flex-1 text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                          p.id === activeProfileId && 'bg-accent font-medium'
                        )}
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenameText(p.name); }}
                        className="px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        title="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )
                ))}
                <div className="border-t mt-1 pt-1">
                  {showNewProfile ? (
                    <div className="px-3 py-1.5 flex gap-1">
                      <input
                        value={newProfileName}
                        onChange={e => setNewProfileName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createProfile(); if (e.key === 'Escape') setShowNewProfile(false); }}
                        placeholder="Profile name"
                        className="flex-1 text-sm bg-transparent border rounded px-2 py-1 outline-none focus:ring-1 ring-primary"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewProfile(true)}
                      className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" /> New Profile
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1 px-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Logout — pinned to the bottom of the sidebar */}
          <div className="px-2 mt-2 pt-2 border-t">
            <button
              onClick={logout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:pl-56 pb-20 md:pb-0 pt-12 md:pt-0 min-h-screen flex flex-col">
        <div className="max-w-7xl mx-auto p-4 md:p-6 w-full flex-1">{children}</div>
        <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pb-6 text-xs text-muted-foreground mt-auto">
          <p className="mb-1">Informational only — not financial advice. Verify all figures with your broker.</p>
          <div className="flex gap-3">
            <Link href="/disclaimer" className="hover:text-foreground">Disclaimer</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t z-50">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center py-2 px-3 text-xs',
                pathname.startsWith(item.href)
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5 mb-1" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile profile selector - top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 bg-background border-b z-50 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Portfolio Tracker</span>
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-accent/50"
          >
            <span>{activeProfile?.name || 'Profile'}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showProfileMenu && (
            <div className="absolute z-50 top-full right-0 mt-1 bg-popover border rounded-md shadow-lg py-1 min-w-[160px]">
              {profiles.map(p => (
                renamingId === p.id ? (
                  <div key={p.id} className="px-3 py-1.5">
                    <input
                      value={renameText}
                      onChange={e => setRenameText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameProfile(); if (e.key === 'Escape') setRenamingId(null); }}
                      className="w-full text-sm bg-transparent border rounded px-2 py-1 outline-none focus:ring-1 ring-primary"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div key={p.id} className="flex items-center group">
                    <button
                      onClick={() => { setActiveProfileId(p.id); setShowProfileMenu(false); }}
                      className={cn(
                        'flex-1 text-left px-3 py-1.5 text-sm hover:bg-accent',
                        p.id === activeProfileId && 'bg-accent font-medium'
                      )}
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenameText(p.name); }}
                      className="px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )
              ))}
              <div className="border-t mt-1 pt-1">
                {showNewProfile ? (
                  <div className="px-3 py-1.5">
                    <input
                      value={newProfileName}
                      onChange={e => setNewProfileName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createProfile(); if (e.key === 'Escape') setShowNewProfile(false); }}
                      placeholder="Profile name"
                      className="w-full text-sm bg-transparent border rounded px-2 py-1 outline-none"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewProfile(true)}
                    className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> New Profile
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
