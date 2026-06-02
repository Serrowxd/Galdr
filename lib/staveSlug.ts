import { eq } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { staves } from "@/db/schema";

const MAX_SLUG_LEN = 80;
// Reserve room for the "-<token>" disambiguator appended to every published slug.
const TOKEN_LENGTHS = [6, 8, 12, 32] as const;

export function slugifyTitle(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, MAX_SLUG_LEN) || "untitled-stave"
  );
}

/**
 * Builds a shaped slug: the title stem plus a short, stable disambiguator
 * derived from the stave's own id — e.g. `create-things-3142d9`.
 *
 * Why a token instead of a numeric suffix: a global `slug` namespace with `-2`,
 * `-3` dedup is a land-grab (first publisher gets the clean name, everyone else
 * looks second-class) and the suffix is meaningless. A token off the immutable
 * row id is unique by construction, carries no ranking, and never breaks when a
 * username changes (the slug holds no username). Soft-deleted slugs stay
 * reserved (the unique constraint spans all rows), so we still probe the table.
 *
 * `seedId` is the stave row's uuid — stable for the life of the row, so the slug
 * is deterministic. We widen the token only on the astronomically-rare prefix
 * collision.
 */
export async function generateUniqueSlug(
  db: GaldrDb,
  base: string,
  seedId: string,
): Promise<string> {
  // Leave room for the longest token + separator.
  const stem = base.slice(0, MAX_SLUG_LEN - 33) || "untitled-stave";
  const hex = seedId.replace(/-/g, "").toLowerCase();

  for (const len of TOKEN_LENGTHS) {
    const candidate = `${stem}-${hex.slice(0, len)}`;
    const [row] = await db
      .select({ slug: staves.slug })
      .from(staves)
      .where(eq(staves.slug, candidate))
      .limit(1);
    if (!row) return candidate;
  }
  // Full id can only collide with itself (republish of the same row) — safe.
  return `${stem}-${hex}`;
}
