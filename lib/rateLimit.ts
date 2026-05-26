/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * NOTE: state lives in this module's memory, so limits are per server instance.
 * That's fine as a basic abuse brake in dev / single-instance deploys; for
 * multi-instance serverless it's best-effort, not a hard guarantee. Swap in a
 * shared store (Redis, Upstash) if strict limits are ever needed.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/** Test-only: clear all buckets between cases. */
export function _resetRateLimits(): void {
  buckets.clear();
}
