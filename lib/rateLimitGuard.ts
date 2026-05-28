import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rateLimit";

/**
 * Checks a per-key fixed-window limit. Returns a ready 429 `NextResponse` when the
 * caller is over the limit, or `null` when the request may proceed.
 *
 * Usage:
 *   const limited = enforceRateLimit(`create:${user.id}`, 20, 60_000);
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const result = rateLimit(key, limit, windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) },
    },
  );
}
