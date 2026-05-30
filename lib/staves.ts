import { and, desc, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import {
  staveDownloads,
  staveFiles,
  staves,
  userProfiles,
  type Stave,
} from "@/db/schema";

export type { Stave } from "@/db/schema";

export type StaveStatus = "draft" | "published";

export type StaveWithMetrics = Stave & {
  upvotes: number;
  downvotes: number;
  commentsCount: number;
  savesCount: number;
  downloadsCount: number;
  monthlyScore: number;
  hasNewerVersion: boolean;
  latestSlug: string | null;
  predecessorSlug: string | null;
  authorUsername: string | null;
};

export type ListStavesOpts = {
  status?: StaveStatus;
  authorId?: string;
  q?: string;
  tag?: string;
  sort?: "top" | "new";
  limit?: number;
  offset?: number;
};

export type ListStavesResult = {
  rows: StaveWithMetrics[];
  total: number;
};

export type StaveVersion = {
  version: number;
  slug: string;
  releaseNotes: string | null;
  publishedAt: Date | null;
};

export type ForkAttribution = {
  slug: string | null;
  title: string;
  authorUsername: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards uuid-keyed lookups so a malformed id is a clean miss, not a 500. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function getStaveById(
  db: GaldrDb,
  id: string,
): Promise<Stave | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(staves)
    .where(and(eq(staves.id, id), isNull(staves.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getStaveBySlug(
  db: GaldrDb,
  slug: string,
): Promise<Stave | null> {
  const [row] = await db
    .select()
    .from(staves)
    .where(and(eq(staves.slug, slug), isNull(staves.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function staveExists(db: GaldrDb, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const [row] = await db
    .select({ id: staves.id })
    .from(staves)
    .where(and(eq(staves.id, id), isNull(staves.deletedAt)))
    .limit(1);
  return Boolean(row);
}

/**
 * True only for a live, PUBLISHED stave. Engagement endpoints use this so drafts
 * stay private — a guessed draft uuid is indistinguishable from a miss (both 404).
 */
export async function publishedStaveExists(
  db: GaldrDb,
  id: string,
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const [row] = await db
    .select({ id: staves.id })
    .from(staves)
    .where(
      and(
        eq(staves.id, id),
        eq(staves.status, "published"),
        isNull(staves.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export type CreateStaveInput = {
  authorId: string;
  title: string;
  body: string;
  description?: string | null;
  tags?: string[];
  license?: string;
  // Curated package files (Loom explorer). When present, written atomically with
  // the draft row. The entrypoint file's content is also mirrored into `body`.
  files?: { path: string; content: string }[];
  // Path of the file that mirrors `body`. Null → resolved heuristically on load.
  entrypointPath?: string | null;
};

export async function createStave(
  db: GaldrDb,
  input: CreateStaveInput,
): Promise<{ id: string }> {
  // Option B: generate the id in-app so family_id can equal it in one insert.
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(staves).values({
      id,
      familyId: id,
      slug: `draft-${id.slice(0, 8)}`,
      authorId: input.authorId,
      title: input.title,
      body: input.body,
      entrypointPath: input.entrypointPath ?? null,
      description: input.description ?? null,
      tags: input.tags ?? [],
      license: input.license ?? "CC BY 4.0",
      status: "draft",
      version: 1,
    });
    if (input.files && input.files.length > 0) {
      await replaceStaveFiles(tx, id, input.files);
    }
  });
  return { id };
}

export type UploadedStaveInput = {
  authorId: string;
  title: string;
  body: string;
  description: string | null;
  tags: string[];
  license: string;
  files: { path: string; content: string }[];
};

/** Inserts a draft stave plus its package files in a single transaction. */
export async function createUploadedStave(
  db: GaldrDb,
  input: UploadedStaveInput,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(staves).values({
      id,
      familyId: id,
      slug: `draft-${id.slice(0, 8)}`,
      authorId: input.authorId,
      title: input.title,
      description: input.description,
      body: input.body,
      tags: input.tags,
      license: input.license,
      status: "draft",
      version: 1,
    });
    if (input.files.length > 0) {
      await tx
        .insert(staveFiles)
        .values(
          input.files.map((f) => ({ staveId: id, path: f.path, content: f.content })),
        );
    }
  });
  return { id };
}

export type UpdateStavePatch = Partial<{
  title: string;
  description: string | null;
  body: string;
  tags: string[];
  license: string;
  entrypointPath: string | null;
}>;

/**
 * Refuses to mutate a published row (immutable releases — see spec 03). When
 * `files` is provided, the row update and the package-file swap run in one
 * transaction so the body and its files never diverge.
 */
export async function updateStave(
  db: GaldrDb,
  id: string,
  patch: UpdateStavePatch,
  files?: { path: string; content: string }[],
): Promise<{ ok: boolean; reason?: "not_found" | "published" }> {
  const existing = await getStaveById(db, id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status === "published") return { ok: false, reason: "published" };

  await db.transaction(async (tx) => {
    await tx
      .update(staves)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(staves.id, id), isNull(staves.deletedAt)));
    if (files) {
      await replaceStaveFiles(tx, id, files);
    }
  });
  return { ok: true };
}

export async function softDeleteStave(db: GaldrDb, id: string): Promise<void> {
  await db
    .update(staves)
    .set({ deletedAt: new Date() })
    .where(and(eq(staves.id, id), isNull(staves.deletedAt)));
}

type GaldrTx = Parameters<Parameters<GaldrDb["transaction"]>[0]>[0];

/**
 * Replaces a stave's entire package-file set: clears existing rows, inserts the
 * new ones. Runs inside a caller-provided transaction so the swap is atomic with
 * the body/title update. Callers must validate paths/sizes first
 * (validatePackageFiles) — this trusts its input.
 */
export async function replaceStaveFiles(
  tx: GaldrTx,
  staveId: string,
  files: { path: string; content: string }[],
): Promise<void> {
  await tx.delete(staveFiles).where(eq(staveFiles.staveId, staveId));
  if (files.length > 0) {
    await tx
      .insert(staveFiles)
      .values(files.map((f) => ({ staveId, path: f.path, content: f.content })));
  }
}

/**
 * Records a download (counts aggregated in listStaves and feed registry ranking).
 * To blunt count-gaming, a signed-in user's repeat downloads of the same stave
 * within `dedupeWindowMs` are not re-counted. Anonymous downloads can't be deduped
 * without storing an identifier (we don't store IPs), so they rely on the route's
 * rate limit instead. Returns true if a row was inserted.
 */
export async function recordStaveDownload(
  db: GaldrDb,
  staveId: string,
  userId: string | null,
  dedupeWindowMs = 60 * 60 * 1000, // 1 hour
): Promise<boolean> {
  if (userId) {
    const since = new Date(Date.now() - dedupeWindowMs);
    const [recent] = await db
      .select({ id: staveDownloads.id })
      .from(staveDownloads)
      .where(
        and(
          eq(staveDownloads.staveId, staveId),
          eq(staveDownloads.userId, userId),
          gte(staveDownloads.downloadedAt, since),
        ),
      )
      .limit(1);
    if (recent) return false;
  }
  await db.insert(staveDownloads).values({ staveId, userId });
  return true;
}

async function copyStaveFiles(
  tx: GaldrTx,
  fromStaveId: string,
  toStaveId: string,
): Promise<void> {
  const files = await tx
    .select({ path: staveFiles.path, content: staveFiles.content })
    .from(staveFiles)
    .where(eq(staveFiles.staveId, fromStaveId));
  if (files.length === 0) return;
  await tx
    .insert(staveFiles)
    .values(files.map((f) => ({ staveId: toStaveId, path: f.path, content: f.content })));
}

/** Publishes a draft: locks the slug, stamps published_at, writes release notes. */
export async function publishStave(
  db: GaldrDb,
  id: string,
  slug: string,
  releaseNotes: string | null,
  isPrivate = false,
): Promise<void> {
  await db
    .update(staves)
    .set({
      status: "published",
      publishedAt: new Date(),
      slug,
      releaseNotes,
      private: isPrivate,
      updatedAt: new Date(),
    })
    .where(and(eq(staves.id, id), isNull(staves.deletedAt)));
}

/** Creates a new-version draft within the parent's family. Copies package files. */
export async function createNewVersion(
  db: GaldrDb,
  parent: Stave,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(staves).values({
      id,
      slug: `draft-${id.slice(0, 8)}`,
      authorId: parent.authorId,
      title: parent.title,
      description: parent.description,
      body: parent.body,
      entrypointPath: parent.entrypointPath,
      tags: parent.tags,
      license: parent.license,
      status: "draft",
      version: parent.version + 1,
      familyId: parent.familyId,
      predecessorId: parent.id,
      forkedFrom: parent.forkedFrom,
    });
    await copyStaveFiles(tx, parent.id, id);
  });
  return { id };
}

/** Forks a published stave into a new family owned by the caller. Copies files. */
export async function forkStave(
  db: GaldrDb,
  parent: Stave,
  userId: string,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(staves).values({
      id,
      familyId: id,
      slug: `draft-${id.slice(0, 8)}`,
      authorId: userId,
      title: `${parent.title} (fork)`,
      description: parent.description,
      body: parent.body,
      entrypointPath: parent.entrypointPath,
      tags: parent.tags,
      license: parent.license,
      status: "draft",
      version: 1,
      predecessorId: null,
      forkedFrom: parent.id,
    });
    await copyStaveFiles(tx, parent.id, id);
  });
  return { id };
}

export async function getStavesByIds(
  db: GaldrDb,
  ids: string[],
): Promise<Stave[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(staves)
    .where(and(inArray(staves.id, ids), isNull(staves.deletedAt)));
  // Preserve the order of the requested ids.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Stave => Boolean(r));
}

export async function getStavesByAuthor(
  db: GaldrDb,
  authorId: string,
  opts: { status?: StaveStatus; includePrivate?: boolean } = {},
): Promise<Stave[]> {
  const conditions = [eq(staves.authorId, authorId), isNull(staves.deletedAt)];
  if (opts.status) conditions.push(eq(staves.status, opts.status));
  // Private staves are owner-only; callers serving a public audience pass
  // includePrivate: false to exclude them.
  if (opts.includePrivate === false) conditions.push(eq(staves.private, false));
  return db
    .select()
    .from(staves)
    .where(and(...conditions))
    .orderBy(desc(staves.version), desc(staves.createdAt));
}

export async function getVersionsByFamily(
  db: GaldrDb,
  familyId: string,
): Promise<StaveVersion[]> {
  return db
    .select({
      version: staves.version,
      slug: staves.slug,
      releaseNotes: staves.releaseNotes,
      publishedAt: staves.publishedAt,
    })
    .from(staves)
    .where(
      and(
        eq(staves.familyId, familyId),
        eq(staves.status, "published"),
        eq(staves.private, false),
        isNull(staves.deletedAt),
      ),
    )
    .orderBy(desc(staves.version));
}

/** Thin lookup for the "forked from" badge — title + author username via join. */
export async function getStaveAttribution(
  db: GaldrDb,
  id: string,
): Promise<ForkAttribution | null> {
  const [row] = await db
    .select({
      slug: staves.slug,
      title: staves.title,
      deletedAt: staves.deletedAt,
      authorUsername: userProfiles.username,
    })
    .from(staves)
    .leftJoin(userProfiles, eq(userProfiles.userId, staves.authorId))
    .where(eq(staves.id, id))
    .limit(1);
  if (!row) return null;
  if (row.deletedAt) {
    return { slug: null, title: "[deleted]", authorUsername: null };
  }
  return {
    slug: row.slug,
    title: row.title,
    authorUsername: row.authorUsername,
  };
}

type RawStaveMetricsRow = {
  id: string;
  slug: string;
  author_id: string;
  title: string;
  description: string | null;
  body: string;
  entrypoint_path: string | null;
  tags: string[];
  status: string;
  license: string;
  private: boolean;
  version: number;
  family_id: string;
  predecessor_id: string | null;
  forked_from: string | null;
  release_notes: string | null;
  views_count: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  deleted_at: Date | null;
  upvotes: number | string;
  downvotes: number | string;
  comments_count: number | string;
  saves_count: number | string;
  downloads_count: number | string;
  monthly_score: number | string;
  has_newer_version: boolean;
  latest_slug: string | null;
  predecessor_slug: string | null;
  author_username: string | null;
};

function mapMetricsRow(r: RawStaveMetricsRow): StaveWithMetrics {
  const hasNewer = Boolean(r.has_newer_version);
  return {
    id: r.id,
    slug: r.slug,
    authorId: r.author_id,
    title: r.title,
    description: r.description,
    body: r.body,
    entrypointPath: r.entrypoint_path,
    tags: r.tags ?? [],
    status: r.status,
    license: r.license,
    private: r.private,
    version: r.version,
    familyId: r.family_id,
    predecessorId: r.predecessor_id,
    forkedFrom: r.forked_from,
    releaseNotes: r.release_notes,
    viewsCount: r.views_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
    deletedAt: r.deleted_at,
    upvotes: Number(r.upvotes),
    downvotes: Number(r.downvotes),
    commentsCount: Number(r.comments_count),
    savesCount: Number(r.saves_count),
    downloadsCount: Number(r.downloads_count),
    monthlyScore: Number(r.monthly_score),
    hasNewerVersion: hasNewer,
    latestSlug: hasNewer ? r.latest_slug : null,
    predecessorSlug: r.predecessor_slug,
    authorUsername: r.author_username,
  };
}

/**
 * Single composed query for the registry / saga feeds. Computes lifetime
 * engagement plus a 30-day "monthly score" without N+1. See spec 04.
 */
export async function listStaves(
  db: GaldrDb,
  opts: ListStavesOpts = {},
): Promise<ListStavesResult> {
  const status = opts.status ?? "published";
  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  const sort = opts.sort ?? "top";

  const where: SQL[] = [
    sql`s.deleted_at IS NULL`,
    sql`s.status = ${status}`,
    sql`s.private = false`,
  ];
  if (opts.authorId) where.push(sql`s.author_id = ${opts.authorId}`);
  if (opts.q && opts.q.trim()) {
    const pattern = `%${opts.q.trim()}%`;
    where.push(sql`(s.title ILIKE ${pattern} OR s.description ILIKE ${pattern})`);
  }
  if (opts.tag) where.push(sql`${opts.tag} = ANY(s.tags)`);
  const whereSql = sql.join(where, sql` AND `);

  const orderSql =
    sort === "new"
      ? sql`s.published_at DESC NULLS LAST`
      : sql`monthly_score DESC, s.published_at DESC NULLS LAST`;

  const rowsResult = await db.execute(sql`
    WITH
      monthly_v AS (
        SELECT stave_id,
               COUNT(*) FILTER (WHERE value > 0) AS m_up,
               COUNT(*) FILTER (WHERE value < 0) AS m_down
        FROM stave_votes
        WHERE created_at >= now() - interval '30 days'
        GROUP BY stave_id
      ),
      monthly_d AS (
        SELECT stave_id, COUNT(*) AS m_dl
        FROM stave_downloads
        WHERE downloaded_at >= now() - interval '30 days'
        GROUP BY stave_id
      ),
      lifetime_v AS (
        SELECT stave_id,
               COUNT(*) FILTER (WHERE value > 0) AS up,
               COUNT(*) FILTER (WHERE value < 0) AS down
        FROM stave_votes
        GROUP BY stave_id
      ),
      lifetime_c AS (
        SELECT stave_id, COUNT(*) AS c
        FROM comments
        GROUP BY stave_id
      ),
      lifetime_s AS (
        SELECT stave_id, COUNT(*) AS saves
        FROM saved_staves
        GROUP BY stave_id
      ),
      lifetime_d AS (
        SELECT stave_id, COUNT(*) AS dl
        FROM stave_downloads
        GROUP BY stave_id
      )
    SELECT s.*,
           COALESCE(lifetime_v.up, 0)   AS upvotes,
           COALESCE(lifetime_v.down, 0) AS downvotes,
           COALESCE(lifetime_c.c, 0)    AS comments_count,
           COALESCE(lifetime_s.saves, 0) AS saves_count,
           COALESCE(lifetime_d.dl, 0)   AS downloads_count,
           up.username AS author_username,
           COALESCE(monthly_v.m_up, 0) - COALESCE(monthly_v.m_down, 0)
             + COALESCE(monthly_d.m_dl, 0) AS monthly_score,
           EXISTS (
             SELECT 1 FROM staves s2
             WHERE s2.family_id = s.family_id
               AND s2.version > s.version
               AND s2.deleted_at IS NULL
               AND s2.status = 'published'
               AND s2.private = false
           ) AS has_newer_version,
           (
             SELECT s3.slug FROM staves s3
             WHERE s3.family_id = s.family_id
               AND s3.deleted_at IS NULL
               AND s3.status = 'published'
               AND s3.private = false
             ORDER BY s3.version DESC
             LIMIT 1
           ) AS latest_slug,
           (SELECT s4.slug FROM staves s4 WHERE s4.id = s.predecessor_id) AS predecessor_slug
    FROM staves s
    LEFT JOIN monthly_v  ON monthly_v.stave_id  = s.id
    LEFT JOIN monthly_d  ON monthly_d.stave_id  = s.id
    LEFT JOIN lifetime_v ON lifetime_v.stave_id = s.id
    LEFT JOIN lifetime_c ON lifetime_c.stave_id = s.id
    LEFT JOIN lifetime_s ON lifetime_s.stave_id = s.id
    LEFT JOIN lifetime_d ON lifetime_d.stave_id = s.id
    LEFT JOIN user_profiles up ON up.user_id = s.author_id
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM staves s WHERE ${whereSql}
  `);

  const rawRows = rowsResult as unknown as RawStaveMetricsRow[];
  // TODO(verify-with-data): COUNT(*) comes back as a bigint -> string via postgres-js;
  // Number() handles it, but this was only exercised against an empty DB. Re-verify the
  // count + metric coercions (upvotes/downvotes/monthly_score) once real rows exist.
  const totalRow = (countResult as unknown as { total: number | string }[])[0];

  return {
    rows: rawRows.map(mapMetricsRow),
    total: Number(totalRow?.total ?? 0),
  };
}

export async function getTrendingTags(
  db: GaldrDb,
  limit = 10,
): Promise<{ tag: string; count: number }[]> {
  const result = await db.execute(sql`
    SELECT tag, COUNT(*) AS n
    FROM staves, UNNEST(tags) AS tag
    WHERE status = 'published' AND deleted_at IS NULL AND private = false
    GROUP BY tag
    ORDER BY n DESC
    LIMIT ${limit}
  `);
  const rows = result as unknown as { tag: string; n: number | string }[];
  return rows.map((r) => ({ tag: r.tag, count: Number(r.n) }));
}

export async function getTopScribes(
  db: GaldrDb,
  limit = 10,
): Promise<{ username: string; userId: string; staveCount: number }[]> {
  const result = await db.execute(sql`
    SELECT up.username, up.user_id, COUNT(s.id) AS stave_count
    FROM staves s
    JOIN user_profiles up ON up.user_id = s.author_id
    WHERE s.status = 'published' AND s.deleted_at IS NULL AND s.private = false
    GROUP BY up.username, up.user_id
    ORDER BY stave_count DESC
    LIMIT ${limit}
  `);
  const rows = result as unknown as {
    username: string;
    user_id: string;
    stave_count: number | string;
  }[];
  return rows.map((r) => ({
    username: r.username,
    userId: r.user_id,
    staveCount: Number(r.stave_count),
  }));
}
