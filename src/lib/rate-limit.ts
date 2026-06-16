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
}

export const PRICE_FETCH_COOLDOWN_MS = 60_000;
