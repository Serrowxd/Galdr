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

/**
 * Best-effort client IP from proxy headers, for rate-limiting anonymous requests.
 * Falls back to "unknown" (so all keyless clients share one bucket) when no header
 * is present. Not trusted for security decisions — only for coarse abuse throttling.
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
