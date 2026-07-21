import { ProfileProvider } from '@/components/profile-context';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      {children}
    </ProfileProvider>
  );
}
