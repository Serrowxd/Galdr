import { like, sql } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { grimoires } from "@/db/schema";

const MAX_SLUG_LEN = 80;

export function slugifyGrimoireTitle(title: string): string {
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
      .slice(0, MAX_SLUG_LEN) || "untitled-grimoire"
  );
}

/**
 * Returns a slug not held by any grimoire. Soft-deleted slugs stay reserved (the
 * `slug` unique constraint spans all rows), so we check every row to keep old
 * links from resolving to different content. Mirrors lib/staveSlug.ts.
 */
export async function generateUniqueGrimoireSlug(
  db: GaldrDb,
  base: string,
): Promise<string> {
  const trimmedBase = base.slice(0, MAX_SLUG_LEN - 6) || "untitled-grimoire";

  const rows = await db
    .select({ slug: grimoires.slug })
    .from(grimoires)
    .where(like(grimoires.slug, sql`${trimmedBase + "%"}`));
  const taken = new Set(rows.map((r) => r.slug));

  if (!taken.has(trimmedBase)) return trimmedBase;
  for (let n = 2; ; n++) {
    const candidate = `${trimmedBase}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
