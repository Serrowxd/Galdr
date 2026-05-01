/**
 * Canonical grimoire URL segments: lowercase trim (aligned with mock `scribeSlug` values).
 */

export function normalizeGrimoirePathSlug(segment: string): string {
  return segment.trim().toLowerCase();
}

/**
 * Clerk username → path slug. Returns null if missing or whitespace-only after trim.
 */
export function grimoireSlugFromUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed.length) return null;
  return normalizeGrimoirePathSlug(trimmed);
}
