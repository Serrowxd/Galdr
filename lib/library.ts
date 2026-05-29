import { sql } from "drizzle-orm";

import type { GaldrDb } from "@/db";

const LIMIT = 50;

export type LibraryStaveRow = {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  version: number;
  status: string;
  owned: boolean;
  authorUsername: string | null;
  savesCount: number;
  downloadsCount: number;
  updatedAt: Date;
};

export type LibraryGrimoireRow = {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  version: number;
  status: string;
  owned: boolean;
  authorUsername: string | null;
  savesCount: number;
  downloadsCount: number;
  staveCount: number;
  updatedAt: Date;
  savedAt: Date | null;
};

type RawStaveRow = {
  id: string;
  family_id: string;
  slug: string;
  title: string;
  tags: string[];
  version: number | string;
  status: string;
  owned: boolean;
  author_username: string | null;
  saves_count: number | string;
  downloads_count: number | string;
  updated_at: Date;
};

/** Staves the user owns (any status) or has saved, with engagement counts. */
export async function getLibraryStaves(
  db: GaldrDb,
  userId: string,
): Promise<LibraryStaveRow[]> {
  // Collapse each version chain to its highest version in SQL (DISTINCT ON), then
  // order and limit — so the LIMIT counts families, not individual versions.
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (s.family_id)
             s.id, s.family_id, s.slug, s.title, s.tags, s.version, s.status,
             s.updated_at,
             (s.author_id = ${userId}) AS owned,
             up.username AS author_username,
             COALESCE(sv.n, 0) AS saves_count,
             COALESCE(dl.n, 0) AS downloads_count
      FROM staves s
      LEFT JOIN user_profiles up ON up.user_id = s.author_id
      LEFT JOIN (SELECT stave_id, COUNT(*) AS n FROM saved_staves GROUP BY stave_id) sv
        ON sv.stave_id = s.id
      LEFT JOIN (SELECT stave_id, COUNT(*) AS n FROM stave_downloads GROUP BY stave_id) dl
        ON dl.stave_id = s.id
      WHERE s.deleted_at IS NULL
        AND (
          s.author_id = ${userId}
          OR s.id IN (SELECT stave_id FROM saved_staves WHERE user_id = ${userId})
        )
      ORDER BY s.family_id, s.version DESC
    ) fam
    ORDER BY fam.updated_at DESC
    LIMIT ${LIMIT}
  `);
  const rows = result as unknown as RawStaveRow[];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tags: r.tags ?? [],
    version: Number(r.version),
    status: r.status,
    owned: Boolean(r.owned),
    authorUsername: r.author_username,
    savesCount: Number(r.saves_count),
    downloadsCount: Number(r.downloads_count),
    updatedAt: r.updated_at,
  }));
}

type RawGrimoireRow = {
  id: string;
  family_id: string;
  slug: string;
  title: string;
  tags: string[];
  version: number | string;
  status: string;
  owned: boolean;
  author_username: string | null;
  saves_count: number | string;
  downloads_count: number | string;
  stave_count: number | string;
  updated_at: Date;
  saved_at: Date | null;
};

/** Grimoires the user owns (any status) or has saved, with engagement counts. */
export async function getLibraryGrimoires(
  db: GaldrDb,
  userId: string,
): Promise<LibraryGrimoireRow[]> {
  // Collapse each version chain to its highest version in SQL (DISTINCT ON), then
  // order and limit — so the LIMIT counts families, not individual versions.
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (g.family_id)
             g.id, g.family_id, g.slug, g.title, g.tags, g.version, g.status,
             g.updated_at, g.downloads_count,
             (g.author_id = ${userId}) AS owned,
             up.username AS author_username,
             COALESCE(sv.n, 0) AS saves_count,
             COALESCE(ec.n, 0) AS stave_count,
             sg.created_at AS saved_at
      FROM grimoires g
      LEFT JOIN user_profiles up ON up.user_id = g.author_id
      LEFT JOIN (SELECT grimoire_id, COUNT(*) AS n FROM saved_grimoires GROUP BY grimoire_id) sv
        ON sv.grimoire_id = g.id
      LEFT JOIN (SELECT grimoire_id, COUNT(*) AS n FROM grimoire_entries GROUP BY grimoire_id) ec
        ON ec.grimoire_id = g.id
      LEFT JOIN saved_grimoires sg
        ON sg.grimoire_id = g.id AND sg.user_id = ${userId}
      WHERE g.deleted_at IS NULL
        AND (
          g.author_id = ${userId}
          OR g.id IN (SELECT grimoire_id FROM saved_grimoires WHERE user_id = ${userId})
        )
      ORDER BY g.family_id, g.version DESC
    ) fam
    ORDER BY fam.updated_at DESC
    LIMIT ${LIMIT}
  `);
  const rows = result as unknown as RawGrimoireRow[];
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    tags: r.tags ?? [],
    version: Number(r.version),
    status: r.status,
    owned: Boolean(r.owned),
    authorUsername: r.author_username,
    savesCount: Number(r.saves_count),
    downloadsCount: Number(r.downloads_count),
    staveCount: Number(r.stave_count),
    updatedAt: r.updated_at,
    savedAt: r.saved_at,
  }));
}
