import { like, sql } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { staves } from "@/db/schema";

const MAX_SLUG_LEN = 80;

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
 * Returns a slug not currently held by any stave. Soft-deleted slugs stay
 * reserved (the `slug` unique constraint spans all rows), so we check every row
 * — not just live ones — to keep old links from resolving to different content.
 */
export async function generateUniqueSlug(
  db: GaldrDb,
  base: string,
): Promise<string> {
  // Leave room for a numeric suffix.
  const trimmedBase = base.slice(0, MAX_SLUG_LEN - 6) || "untitled-stave";

  const rows = await db
    .select({ slug: staves.slug })
    .from(staves)
    .where(like(staves.slug, sql`${trimmedBase + "%"}`));
  const taken = new Set(rows.map((r) => r.slug));

  if (!taken.has(trimmedBase)) return trimmedBase;
  for (let n = 2; ; n++) {
    const candidate = `${trimmedBase}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
