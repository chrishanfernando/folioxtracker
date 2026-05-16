import { setDefaultResultOrder } from "node:dns";
import type { NextConfig } from "next";

// Prefer IPv4 for outbound fetches: Node's undici tries AAAA first, and on
// hosts where IPv6 hangs (vs. failing fast), OAuth token exchange times out.
setDefaultResultOrder("ipv4first");

const nextConfig: NextConfig = {
  devIndicators: false,
};

export default nextConfig;
