'use client';

import { createAuthClient } from 'better-auth/react';

// Use the page's own origin so auth fetches go to the same host that served
// the page. This lets the app work over LAN (e.g. accessing the dev server
// from a phone at http://<mac-ip>:3000) without the client hard-coding
// localhost from NEXT_PUBLIC_APP_URL.
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  sendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  deleteUser,
} = authClient;
