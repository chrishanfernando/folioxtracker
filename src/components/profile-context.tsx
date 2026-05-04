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
  const [activeProfileId, setActiveProfileIdState] = useState<number>(1);

  const refreshProfiles = useCallback(async () => {
    const res = await fetch('/api/profiles');
    const data = await res.json();
    setProfiles(data);
  }, []);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('activeProfileId');
    if (stored) setActiveProfileIdState(parseInt(stored) || 1);
    refreshProfiles();
  }, [refreshProfiles]);

  const setActiveProfileId = useCallback((id: number) => {
    setActiveProfileIdState(id);
    localStorage.setItem('activeProfileId', String(id));
  }, []);

  const profileFetch = useCallback((url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    headers.set('x-profile-id', String(activeProfileId));
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
