/**
 * Canonical saga (public profile) URL segments: lowercase trim, aligned with the
 * stored username.
 */

export function normalizeSagaPathSlug(segment: string): string {
  return segment.trim().toLowerCase();
}

/**
 * Username → path slug. Returns null if missing or whitespace-only after trim.
 */
export function sagaSlugFromUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed.length) return null;
  return normalizeSagaPathSlug(trimmed);
}
