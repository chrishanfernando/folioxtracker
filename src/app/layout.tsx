import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ProfileProvider } from '@/components/profile-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Portfolio Tracker',
  description: 'Personal investment portfolio tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ProfileProvider>
          {children}
        </ProfileProvider>
        <Toaster />
      </body>
    </html>
  );
}
