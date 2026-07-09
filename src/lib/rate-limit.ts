/**
 * In-memory, per-user rate limiter for cheap actions like the price-fetch
 * cooldown. Single-instance only — lost on restart, not shared across
 * replicas. That's acceptable for the RPi single-instance deploy; if we ever
 * go multi-instance this moves to Redis or the DB.
 */

const buckets = new Map<string, Map<string, number>>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Record an attempt for (bucket, key) at the given timestamp and return
 * whether it's within the cooldown.
 */
export function checkCooldown(bucket: string, key: string, cooldownMs: number, now: number = Date.now()): RateLimitResult {
  let inner = buckets.get(bucket);
  if (!inner) {
    inner = new Map();
    buckets.set(bucket, inner);
  }
  const last = inner.get(key);
  if (last !== undefined) {
    const elapsed = now - last;
    if (elapsed < cooldownMs) {
      return { allowed: false, retryAfterMs: cooldownMs - elapsed };
    }
  }
  inner.set(key, now);
  return { allowed: true, retryAfterMs: 0 };
}

/** Test helper — clears all buckets. */
export function _resetRateLimit(): void {
  buckets.clear();
  slidingBuckets.clear();
}

export const PRICE_FETCH_COOLDOWN_MS = 60_000;

// ── Sliding-window limiter (for import/API endpoints keyed by user or IP) ──

const slidingBuckets = new Map<string, number[]>();

export interface SlidingLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

/**
 * Sliding-window rate limit. Records this attempt if allowed.
 * `key` should namespace the caller: e.g. `import:${userId}` or `ip:${ip}`.
 */
export function checkSlidingLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): SlidingLimitResult {
  const cutoff = now - windowMs;
  const arr = (slidingBuckets.get(key) || []).filter(t => t > cutoff);
  if (arr.length >= max) {
    const retryAfterMs = arr[0] + windowMs - now;
    slidingBuckets.set(key, arr);
    return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000), remaining: 0 };
  }
  arr.push(now);
  slidingBuckets.set(key, arr);
  return { allowed: true, retryAfterSeconds: 0, remaining: max - arr.length };
}

/**
 * Extract a client IP hint from a NextRequest for rate-limit keying.
 * Not authoritative — CDN headers can be spoofed if not sanitised upstream.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
