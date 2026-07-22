'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

interface Profile {
  id: number;
  name: string;
}

interface ProfileContextValue {
  profiles: Profile[];
  activeProfileId: number;
  activeProfile: Profile | undefined;
  setActiveProfileId: (id: number) => void;
  refreshProfiles: () => Promise<void>;
  /** Adds x-profile-id header to fetch options */
  profileFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // Seed from localStorage synchronously so a returning user's very first data
  // fetch already carries the correct x-profile-id header — this avoids a
  // second, redundant fetch of every page once /api/profiles resolves (the
  // 0 → real-id transition used to re-trigger every page's fetch effect).
  // 0 = unknown (first-ever load): profileFetch omits the header and the server
  // falls back to / lazily creates the user's first profile. `refreshProfiles`
  // still validates the seeded id and corrects it if it belongs to a prior
  // (different) user on this browser.
  const [activeProfileId, setActiveProfileIdState] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const stored = parseInt(localStorage.getItem('activeProfileId') || '');
    return Number.isNaN(stored) || stored <= 0 ? 0 : stored;
  });

  // Latest-value ref so `profileFetch` can stay referentially stable (empty
  // deps) instead of changing identity whenever activeProfileId changes — a
  // changing profileFetch cascaded into every page's fetch callback/effect and
  // caused duplicate requests.
  const activeIdRef = useRef(activeProfileId);
  activeIdRef.current = activeProfileId;

  const refreshProfiles = useCallback(async () => {
    const res = await fetch('/api/profiles');
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;
    setProfiles(data);
    // Ensure the active id belongs to the current user. If localStorage holds
    // an id from a previous session (different user), fall back to the first
    // profile the API returned.
    setActiveProfileIdState((current) => {
      const stored = parseInt(localStorage.getItem('activeProfileId') || '');
      const candidate = !Number.isNaN(stored) ? stored : current;
      const valid = data.some((p: { id: number }) => p.id === candidate);
      const chosen = valid ? candidate : data[0].id;
      if (chosen !== candidate) localStorage.setItem('activeProfileId', String(chosen));
      return chosen;
    });
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const setActiveProfileId = useCallback((id: number) => {
    setActiveProfileIdState(id);
    localStorage.setItem('activeProfileId', String(id));
  }, []);

  const profileFetch = useCallback((url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    const id = activeIdRef.current;
    if (id > 0) headers.set('x-profile-id', String(id));
    return fetch(url, { ...options, headers });
  }, []);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <ProfileContext.Provider value={{ profiles, activeProfileId, activeProfile, setActiveProfileId, refreshProfiles, profileFetch }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
