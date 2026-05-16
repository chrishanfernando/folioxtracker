'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile } from '@/components/profile-context';

// Routes that should never be gated — either the gate target itself, or
// account-management routes the user might need to access even before they
// complete onboarding.
const EXEMPT_PATHS = ['/risk-profile', '/settings'];

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profileFetch, activeProfileId } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const exempt = EXEMPT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (exempt) return;
    if (activeProfileId <= 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await profileFetch('/api/risk-profile');
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data === null) {
            router.replace('/risk-profile');
            return;
          }
        }
      } catch {
        // Network/API failure — fail open so a transient error can't lock
        // the user out of the app entirely.
      }
      if (!cancelled) setChecked(true);
    })();

    return () => { cancelled = true; };
  }, [activeProfileId, exempt, profileFetch, router]);

  if (exempt) return <>{children}</>;
  if (!checked) return null;
  return <>{children}</>;
}
