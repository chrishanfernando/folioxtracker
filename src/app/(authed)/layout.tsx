import { ProfileProvider } from '@/components/profile-context';
import { OnboardingGate } from '@/components/onboarding-gate';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <OnboardingGate>{children}</OnboardingGate>
    </ProfileProvider>
  );
}
