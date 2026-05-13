'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

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
  // 0 = not yet resolved; profileFetch omits the x-profile-id header in this
  // state so the server falls back to the user's first owned profile rather
  // than 404-ing on a default that might not belong to this user.
  const [activeProfileId, setActiveProfileIdState] = useState<number>(0);

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
    if (activeProfileId > 0) headers.set('x-profile-id', String(activeProfileId));
    return fetch(url, { ...options, headers });
  }, [activeProfileId]);

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
