import { setDefaultResultOrder } from "node:dns";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Prefer IPv4 for outbound fetches: Node's undici tries AAAA first, and on
// hosts where IPv6 hangs (vs. failing fast), OAuth token exchange times out.
setDefaultResultOrder("ipv4first");

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 2 years; add `preload` once the domain is submitted to the HSTS preload list.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// withSentryConfig is a no-op at runtime when SENTRY_DSN is unset. Uploading
// source maps only happens when both SENTRY_AUTH_TOKEN and org/project are set.
const withSentry = process.env.SENTRY_DSN
  ? (cfg: NextConfig) => withSentryConfig(cfg, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      // Only upload source maps if the auth token is present.
      sourcemaps: process.env.SENTRY_AUTH_TOKEN ? undefined : { disable: true },
      disableLogger: true,
    })
  : (cfg: NextConfig) => cfg;

export default withSentry(nextConfig);
