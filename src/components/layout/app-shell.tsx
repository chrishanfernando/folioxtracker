'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, List, ArrowLeftRight, Target, Upload, Settings, Plus, ChevronDown, Pencil, LineChart, BookOpen, LogOut, Menu, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/components/profile-context';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { signOut } from '@/lib/auth-client';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/holdings', label: 'Holdings', icon: List },
  { href: '/charts', label: 'Charts', icon: LineChart },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/rebalance', label: 'Rebalance', icon: Target },
  { href: '/fees', label: 'Fees', icon: Percent },
  { href: '/portfolios', label: 'Portfolios', icon: BookOpen },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profiles, activeProfileId, activeProfile, setActiveProfileId, refreshProfiles } = useProfile();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Close the mobile overflow menu after navigating.
  useEffect(() => {
    setShowMoreMenu(false);
  }, [pathname]);

  // Dismiss the profile menu on outside click or Escape (the hand-rolled
  // dropdown has no built-in dismissal). Only listens while it's open.
  useEffect(() => {
    if (!showProfileMenu) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowProfileMenu(false); setRenamingId(null); }
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-profile-menu]')) setShowProfileMenu(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [showProfileMenu]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Better Auth's client signOut resolves with `{ data, error }` and does
      // NOT throw on a non-2xx response — the failure is reported in `error`.
      // Previously that error was ignored and we redirected to /login
      // regardless, so a failed sign-out left the session cookie intact while
      // the UI implied the user was logged out. On mobile this surfaced as:
      // "log out" → login page, but editing the URL back to / (which redirects
      // authed users to /dashboard) still showed the user's real data.
      const res = await signOut();
      if (res?.error) throw new Error(res.error.message ?? 'sign-out failed');
    } catch {
      toast.error('Failed to log out. Please try again.');
      setLoggingOut(false);
      return;
    }
    // Use a full document navigation rather than router.push: this tears down
    // all in-memory React state, the Next.js Router Cache, and any bfcache
    // snapshot of authenticated pages, and forces a fresh unauthenticated
    // request so the now-cleared session cookie actually takes effect.
    window.location.href = '/login';
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
            <h1 className="text-lg font-semibold">FolioX Tracker</h1>
          </div>

          {/* Profile Selector */}
          <div className="px-3 mb-4 relative" data-profile-menu>
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
                        className="px-2 py-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        title="Rename"
                        aria-label={`Rename profile ${p.name}`}
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
                aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
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
        {showMoreMenu && (
          <div className="absolute bottom-full inset-x-0 bg-background border-t shadow-lg">
            {navItems.slice(4).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMoreMenu(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm border-b',
                  pathname.startsWith(item.href)
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => { setShowMoreMenu(false); logout(); }}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        )}
        <div className="flex justify-around">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
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
          <button
            onClick={() => setShowMoreMenu(v => !v)}
            className={cn(
              'flex flex-col items-center py-2 px-3 text-xs',
              showMoreMenu || navItems.slice(4).some(i => pathname.startsWith(i.href))
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Menu className="h-5 w-5 mb-1" />
            More
          </button>
        </div>
      </nav>

      {/* Mobile profile selector - top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 bg-background border-b z-50 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold">FolioX Tracker</span>
        <div className="relative" data-profile-menu>
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
                      className="px-2 py-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      aria-label={`Rename profile ${p.name}`}
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
