import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimits, rateLimit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => _resetRateLimits());

  it("allows requests up to the limit within the window", () => {
    const now = 1_000;
    expect(rateLimit("k", 3, 1000, now).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, now).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, now).ok).toBe(true);
  });

  it("blocks the request that exceeds the limit and reports retryAfter", () => {
    const now = 1_000;
    rateLimit("k", 2, 1000, now);
    rateLimit("k", 2, 1000, now);
    const blocked = rateLimit("k", 2, 1000, now + 200);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(800); // resetAt(2000) - now(1200)
  });

  it("resets after the window elapses", () => {
    const now = 1_000;
    rateLimit("k", 1, 1000, now);
    expect(rateLimit("k", 1, 1000, now + 500).ok).toBe(false);
    expect(rateLimit("k", 1, 1000, now + 1000).ok).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const now = 1_000;
    rateLimit("a", 1, 1000, now);
    expect(rateLimit("a", 1, 1000, now).ok).toBe(false);
    expect(rateLimit("b", 1, 1000, now).ok).toBe(true);
  });
});
