// monthly_score is recomputed nightly at 03:00 UTC via pg_cron (scheduled in migration 0006).
// Hot score function: hot_score(vote_score, last_activity_at) — defined in migration 0006.

import { nanoid } from "nanoid";

import { getDbOptional } from "@/db";
import { getDb } from "@/db";
import { threads, staves, userProfiles, threadComments } from "@/db/schema";
import { and, asc, count, desc, eq, gt, isNull, sql } from "drizzle-orm";

// ============================================================
// ERRORS
// ============================================================

export class RateLimitError extends Error {
  constructor() {
    super("rate-limit");
  }
}

export class ValidationError extends Error {}

// ============================================================
// TAG HELPERS
// ============================================================

/**
 * Normalize a raw tag value (or array of values) into a clean array of slugs.
 * - lowercase
 * - strip non-alphanumeric characters (except hyphens)
 * - collapse multiple hyphens
 * - trim leading/trailing hyphens
 * - cap each tag at 24 chars
 * - filter empty strings and dedup
 */
export function normalizeTags(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    // split on comma so a single "foo, bar" string works too
    const parts = item.split(",");
    for (const part of parts) {
      const slug = part
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        result.push(slug);
      }
    }
  }
  return result;
}

// ============================================================
// CREATE THREAD
// ============================================================

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Reserve a unique thread slug. Tries base slug; on collision appends a
 * 6-char UUID fragment.
 */
async function reserveThreadSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  baseSlug: string,
): Promise<string> {
  const existing = await db
    .select({ id: threads.id })
    .from(threads)
    .where(eq(threads.slug, baseSlug))
    .limit(1);

  if (existing.length === 0) {
    return baseSlug;
  }
  // Collision — append first 6 chars of a random UUID
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${baseSlug}-${suffix}`;
}

export async function createThread(input: {
  authorId: string;
  title: string;
  opBody: string;
  format: "discussion" | "documentation";
  category: string | null;
  staveFamilyId: string | null;
  tags: string[];
}): Promise<{ id: string; slug: string }> {
  const db = getDb();

  // 1. Validate title
  const title = input.title.trim();
  if (!title || title.length > 140) {
    throw new ValidationError("Title must be between 1 and 140 characters.");
  }

  // 2. Validate opBody
  if (input.opBody.length > 65536) {
    throw new ValidationError("Post body exceeds 65536 character limit.");
  }

  // 3. Validate: standalone threads need a category
  if (input.staveFamilyId === null && !input.category) {
    throw new ValidationError("Category is required for standalone threads.");
  }

  // 4. Normalize tags and validate count
  const tags = normalizeTags(input.tags);
  if (tags.length > 8) {
    throw new ValidationError("Maximum 8 tags allowed.");
  }

  // 5. Rate-limit check: max 5 threads per user per 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const countResult = await db
    .select({ n: count() })
    .from(threads)
    .where(
      and(
        eq(threads.authorId, input.authorId),
        gt(threads.createdAt, cutoff),
        isNull(threads.deletedAt),
      ),
    );
  const recentCount = countResult[0]?.n ?? 0;
  if (recentCount >= 5) {
    throw new RateLimitError();
  }

  // 6. Generate slug from title
  const baseSlug = slugifyTitle(title) || "thread";

  // 7. Reserve unique slug
  const slug = await reserveThreadSlug(db, baseSlug);

  // 8. Validate category enum
  const validCategories = ["tutorial", "pattern", "question", "showcase", "meta"] as const;
  type ValidCategory = typeof validCategories[number];
  const category =
    input.category && (validCategories as readonly string[]).includes(input.category)
      ? (input.category as ValidCategory)
      : null;

  // 9. INSERT thread row
  const inserted = await db
    .insert(threads)
    .values({
      authorId: input.authorId,
      title,
      slug,
      opBody: input.opBody,
      format: input.format,
      category,
      staveFamilyId: input.staveFamilyId ?? null,
      tags,
      isAutoCreated: false,
      status: "open",
    })
    .returning({ id: threads.id, slug: threads.slug });

  if (!inserted[0]) {
    throw new Error("Thread insert returned no row.");
  }

  return { id: inserted[0].id, slug: inserted[0].slug };
}

export type AutoThread = {
  id: string;
  slug: string;
  title: string;
  opBody: string;
  opEditedAt: Date | null;
  voteScore: number;
  commentsCount: number;
  viewsCount: number;
  isAutoCreated: boolean;
  isPinned: boolean;
  status: string;
  format: string;
  lastActivityAt: Date;
  createdAt: Date;
};

/** Get the auto-created thread for a stave family. */
export async function getAutoThreadForFamily(
  staveFamilyId: string,
): Promise<AutoThread | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: threads.id,
      slug: threads.slug,
      title: threads.title,
      opBody: threads.opBody,
      opEditedAt: threads.opEditedAt,
      voteScore: threads.voteScore,
      commentsCount: threads.commentsCount,
      viewsCount: threads.viewsCount,
      isAutoCreated: threads.isAutoCreated,
      isPinned: threads.isPinned,
      status: threads.status,
      format: threads.format,
      lastActivityAt: threads.lastActivityAt,
      createdAt: threads.createdAt,
    })
    .from(threads)
    .where(
      and(
        eq(threads.staveFamilyId, staveFamilyId),
        eq(threads.isAutoCreated, true),
        isNull(threads.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0] as AutoThread;
}

/**
 * Derive the thread title from a stave:
 * use description capped at 120 chars, or fall back to slug.
 */
export function deriveAutoThreadTitle(stave: {
  description: string | null;
  slug: string;
}): string {
  if (stave.description && stave.description.trim().length > 0) {
    return stave.description.trim().slice(0, 120);
  }
  return stave.slug;
}

/**
 * Generate a safe thread slug from a stave slug.
 * Tries the base slug first; on collision appends a 6-char nanoid.
 * Accepts the full db or a transaction client (typed as any to cover both).
 */
export async function reserveAutoThreadSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  baseSlug: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  const existing = await anyDb
    .select({ id: threads.id })
    .from(threads)
    .where(eq(threads.slug, baseSlug))
    .limit(1);

  if (existing.length === 0) {
    return baseSlug;
  }
  return `${baseSlug}-${nanoid(6)}`;
}

// ============================================================
// TAVERN INDEX FEED
// ============================================================

export type ThreadFeedRow = {
  id: string;
  slug: string;
  title: string;
  opBodyExcerpt: string;
  isDocMode: boolean;
  isAutoCreated: boolean;
  category: string | null;
  staveAttachment: { slug: string; familyId: string } | null;
  author: { id: string; username: string };
  voteScore: number;
  commentsCount: number;
  createdAt: Date;
  lastActivityAt: Date;
  tags: string[];
};

export type TavernIndexInput = {
  sort: "hot" | "new" | "top";
  time: "day" | "week" | "month" | "all";
  surface: "all" | "stave-attached" | "standalone" | "following";
  category: string | null;
  tag: string | null;
  showEmpty: boolean;
  offset: number;
  limit: number;
  viewerId: string | null;
};

export type TavernIndexResult = {
  threads: ThreadFeedRow[];
  hasMore: boolean;
  pinned: ThreadFeedRow | null;
};

/** How far back "day/week/month" time filters look, relative to now. */
function timeWindowStart(time: TavernIndexInput["time"]): Date | null {
  const now = Date.now();
  if (time === "day") return new Date(now - 24 * 60 * 60 * 1000);
  if (time === "week") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (time === "month") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null; // "all"
}

/** Map a raw DB row to the public ThreadFeedRow shape. */
function toFeedRow(row: {
  id: string;
  slug: string;
  title: string;
  opBody: string;
  format: string;
  isAutoCreated: boolean;
  category: string | null;
  staveSlug: string | null;
  staveFamilyId: string | null;
  authorId: string;
  authorUsername: string | null;
  voteScore: number;
  commentsCount: number;
  createdAt: Date;
  lastActivityAt: Date;
  tags: string[];
}): ThreadFeedRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    opBodyExcerpt: row.opBody.slice(0, 280),
    isDocMode: row.format === "documentation",
    isAutoCreated: row.isAutoCreated,
    category: row.category,
    staveAttachment:
      row.staveSlug && row.staveFamilyId
        ? { slug: row.staveSlug, familyId: row.staveFamilyId }
        : null,
    author: {
      id: row.authorId,
      username: row.authorUsername ?? "unknown",
    },
    voteScore: row.voteScore,
    commentsCount: row.commentsCount,
    createdAt: row.createdAt,
    lastActivityAt: row.lastActivityAt,
    tags: row.tags,
  };
}

export async function getTavernIndexPage(
  input: TavernIndexInput,
): Promise<TavernIndexResult> {
  const db = getDbOptional();
  if (!db) return { threads: [], hasMore: false, pinned: null };

  const { sort, time, surface, category, tag, showEmpty, offset, limit } = input;

  // ---- build where conditions incrementally ----
  const conditions: ReturnType<typeof isNull>[] = [isNull(threads.deletedAt)];

  // empty-thread filter
  if (!showEmpty) {
    conditions.push(
      sql`NOT (${threads.opBody} = '' AND ${threads.commentsCount} = 0)` as ReturnType<typeof isNull>,
    );
  }

  // surface filter
  if (surface === "stave-attached") {
    conditions.push(
      sql`${threads.staveFamilyId} IS NOT NULL` as ReturnType<typeof isNull>,
    );
  } else if (surface === "standalone") {
    conditions.push(isNull(threads.staveFamilyId));
  }
  // "following" with no viewerId → return nothing (handled by caller)

  // category filter
  if (category) {
    conditions.push(
      sql`${threads.category}::text = ${category}` as ReturnType<typeof isNull>,
    );
  }

  // tag filter (GIN-friendly: use @> array containment)
  if (tag) {
    conditions.push(
      sql`${threads.tags} @> ARRAY[${tag}]::text[]` as ReturnType<typeof isNull>,
    );
  }

  // time filter (applied to lastActivityAt for hot/new; to createdAt for top)
  const windowStart = sort === "top" ? null : timeWindowStart(time);
  if (windowStart) {
    conditions.push(
      gt(threads.lastActivityAt, windowStart) as ReturnType<typeof isNull>,
    );
  }
  const topWindowStart = sort === "top" ? timeWindowStart(time) : null;
  if (topWindowStart) {
    conditions.push(
      gt(threads.createdAt, topWindowStart) as ReturnType<typeof isNull>,
    );
  }

  // ---- order ----
  const orderBy =
    sort === "new"
      ? desc(threads.createdAt)
      : sort === "top"
        ? desc(threads.voteScore)
        : sql`hot_score(${threads.voteScore}, ${threads.lastActivityAt}) DESC`;

  const fetchLimit = limit + 1;

  const rows = await db
    .select({
      id: threads.id,
      slug: threads.slug,
      title: threads.title,
      opBody: threads.opBody,
      format: threads.format,
      isAutoCreated: threads.isAutoCreated,
      category: threads.category,
      staveFamilyId: threads.staveFamilyId,
      staveSlug: staves.slug,
      authorId: threads.authorId,
      authorUsername: userProfiles.username,
      voteScore: threads.voteScore,
      commentsCount: threads.commentsCount,
      createdAt: threads.createdAt,
      lastActivityAt: threads.lastActivityAt,
      tags: threads.tags,
    })
    .from(threads)
    .leftJoin(userProfiles, eq(threads.authorId, userProfiles.userId))
    .leftJoin(
      staves,
      and(
        eq(threads.staveFamilyId, staves.id),
        isNull(staves.deletedAt),
      ),
    )
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(fetchLimit)
    .offset(offset);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // ---- pinned thread (global, stave-agnostic) ----
  let pinned: ThreadFeedRow | null = null;
  if (offset === 0) {
    const pinnedRows = await db
      .select({
        id: threads.id,
        slug: threads.slug,
        title: threads.title,
        opBody: threads.opBody,
        format: threads.format,
        isAutoCreated: threads.isAutoCreated,
        category: threads.category,
        staveFamilyId: threads.staveFamilyId,
        staveSlug: staves.slug,
        authorId: threads.authorId,
        authorUsername: userProfiles.username,
        voteScore: threads.voteScore,
        commentsCount: threads.commentsCount,
        createdAt: threads.createdAt,
        lastActivityAt: threads.lastActivityAt,
        tags: threads.tags,
      })
      .from(threads)
      .leftJoin(userProfiles, eq(threads.authorId, userProfiles.userId))
      .leftJoin(
        staves,
        and(eq(threads.staveFamilyId, staves.id), isNull(staves.deletedAt)),
      )
      .where(
        and(
          eq(threads.isPinned, true),
          isNull(threads.deletedAt),
          isNull(threads.staveFamilyId),
        ),
      )
      .orderBy(desc(threads.lastActivityAt))
      .limit(1);

    if (pinnedRows.length > 0) {
      pinned = toFeedRow(pinnedRows[0] as Parameters<typeof toFeedRow>[0]);
    }
  }

  return {
    threads: pageRows.map((r) => toFeedRow(r as Parameters<typeof toFeedRow>[0])),
    hasMore,
    pinned,
  };
}

/** Top 4 staves by views in the last 7 days (for the right rail). */
export async function getFeaturedStaves(): Promise<
  { slug: string; title: string; viewsCount: number }[]
> {
  const db = getDbOptional();
  if (!db) return [];

  const rows = await db
    .select({
      slug: staves.slug,
      title: staves.title,
      viewsCount: staves.viewsCount,
    })
    .from(staves)
    .where(
      and(
        isNull(staves.deletedAt),
        eq(staves.status, "published"),
      ),
    )
    .orderBy(desc(staves.viewsCount))
    .limit(4);

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    viewsCount: r.viewsCount,
  }));
}

// ============================================================
// THREAD DETAIL (GALDR-12)
// ============================================================

export type ThreadDetail = {
  id: string;
  slug: string;
  title: string;
  opBody: string;
  opEditedAt: Date | null;
  format: "discussion" | "documentation";
  category: string | null;
  tags: string[];
  status: string;
  isPinned: boolean;
  isAutoCreated: boolean;
  voteScore: number;
  commentsCount: number;
  viewsCount: number;
  createdAt: Date;
  lastActivityAt: Date;
  staveFamilyId: string | null;
  authorId: string;
  author: { id: string; username: string | null };
  staveSlug: string | null;
  staveAuthorId: string | null;
};

export type CommentRow = {
  id: string;
  threadId: string;
  authorId: string;
  authorUsername: string | null;
  replyTo: string | null;
  body: string;
  editedAt: Date | null;
  voteScore: number;
  createdAt: Date;
  isStaveAuthor: boolean;
  replies: CommentRow[];
};

export async function getThreadBySlug(slug: string): Promise<ThreadDetail | null> {
  const db = getDbOptional();
  if (!db) return null;

  const rows = await db
    .select({
      id: threads.id,
      slug: threads.slug,
      title: threads.title,
      opBody: threads.opBody,
      opEditedAt: threads.opEditedAt,
      format: threads.format,
      category: threads.category,
      tags: threads.tags,
      status: threads.status,
      isPinned: threads.isPinned,
      isAutoCreated: threads.isAutoCreated,
      voteScore: threads.voteScore,
      commentsCount: threads.commentsCount,
      viewsCount: threads.viewsCount,
      createdAt: threads.createdAt,
      lastActivityAt: threads.lastActivityAt,
      staveFamilyId: threads.staveFamilyId,
      authorId: threads.authorId,
      authorUsername: userProfiles.username,
      staveSlug: staves.slug,
      staveAuthorId: staves.authorId,
    })
    .from(threads)
    .leftJoin(userProfiles, eq(threads.authorId, userProfiles.userId))
    .leftJoin(
      staves,
      and(eq(threads.staveFamilyId, staves.id), isNull(staves.deletedAt)),
    )
    .where(and(eq(threads.slug, slug), isNull(threads.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    opBody: r.opBody,
    opEditedAt: r.opEditedAt,
    format: r.format as "discussion" | "documentation",
    category: r.category ?? null,
    tags: r.tags,
    status: r.status,
    isPinned: r.isPinned,
    isAutoCreated: r.isAutoCreated,
    voteScore: r.voteScore,
    commentsCount: r.commentsCount,
    viewsCount: r.viewsCount,
    createdAt: r.createdAt,
    lastActivityAt: r.lastActivityAt,
    staveFamilyId: r.staveFamilyId ?? null,
    authorId: r.authorId,
    author: { id: r.authorId, username: r.authorUsername ?? null },
    staveSlug: r.staveSlug ?? null,
    staveAuthorId: r.staveAuthorId ?? null,
  };
}

export async function listComments(
  threadId: string,
  sort: "top" | "new" = "top",
): Promise<CommentRow[]> {
  const db = getDbOptional();
  if (!db) return [];

  // Fetch thread to resolve staveAuthorId
  const threadRows = await db
    .select({ staveFamilyId: threads.staveFamilyId })
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1);

  let staveAuthorId: string | null = null;
  if (threadRows.length > 0 && threadRows[0].staveFamilyId) {
    const staveRows = await db
      .select({ authorId: staves.authorId })
      .from(staves)
      .where(
        and(eq(staves.id, threadRows[0].staveFamilyId), isNull(staves.deletedAt)),
      )
      .limit(1);
    if (staveRows.length > 0) staveAuthorId = staveRows[0].authorId;
  }

  const orderBy =
    sort === "new"
      ? [desc(threadComments.createdAt)]
      : [desc(threadComments.voteScore), asc(threadComments.createdAt)];

  const rows = await db
    .select({
      id: threadComments.id,
      threadId: threadComments.threadId,
      authorId: threadComments.authorId,
      authorUsername: userProfiles.username,
      replyTo: threadComments.replyTo,
      body: threadComments.body,
      editedAt: threadComments.editedAt,
      voteScore: threadComments.voteScore,
      createdAt: threadComments.createdAt,
    })
    .from(threadComments)
    .leftJoin(userProfiles, eq(threadComments.authorId, userProfiles.userId))
    .where(
      and(eq(threadComments.threadId, threadId), isNull(threadComments.deletedAt)),
    )
    .orderBy(...orderBy);

  const flat: CommentRow[] = rows.map((r) => ({
    id: r.id,
    threadId: r.threadId,
    authorId: r.authorId,
    authorUsername: r.authorUsername ?? null,
    replyTo: r.replyTo ?? null,
    body: r.body,
    editedAt: r.editedAt ?? null,
    voteScore: r.voteScore,
    createdAt: r.createdAt,
    isStaveAuthor: staveAuthorId !== null && r.authorId === staveAuthorId,
    replies: [],
  }));

  // Build shallow 2-level tree
  const byId = new Map<string, CommentRow>();
  for (const c of flat) byId.set(c.id, c);

  const roots: CommentRow[] = [];
  for (const c of flat) {
    if (c.replyTo && byId.has(c.replyTo)) {
      byId.get(c.replyTo)!.replies.push(c);
    } else {
      roots.push(c);
    }
  }

  return roots;
}

export async function listParticipants(
  threadId: string,
): Promise<Array<{ id: string; username: string | null; isStaveAuthor: boolean }>> {
  const db = getDbOptional();
  if (!db) return [];

  const threadRows = await db
    .select({ staveFamilyId: threads.staveFamilyId })
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1);

  let staveAuthorId: string | null = null;
  if (threadRows.length > 0 && threadRows[0].staveFamilyId) {
    const staveRows = await db
      .select({ authorId: staves.authorId })
      .from(staves)
      .where(
        and(eq(staves.id, threadRows[0].staveFamilyId), isNull(staves.deletedAt)),
      )
      .limit(1);
    if (staveRows.length > 0) staveAuthorId = staveRows[0].authorId;
  }

  const commentAuthors = await db
    .selectDistinct({
      id: threadComments.authorId,
      username: userProfiles.username,
    })
    .from(threadComments)
    .leftJoin(userProfiles, eq(threadComments.authorId, userProfiles.userId))
    .where(
      and(eq(threadComments.threadId, threadId), isNull(threadComments.deletedAt)),
    );

  return commentAuthors.map((r) => ({
    id: r.id,
    username: r.username ?? null,
    isStaveAuthor: staveAuthorId !== null && r.id === staveAuthorId,
  }));
}

export async function listRelatedThreads(
  threadId: string,
  limit = 3,
): Promise<ThreadFeedRow[]> {
  const db = getDbOptional();
  if (!db) return [];

  const threadRows = await db
    .select({ staveFamilyId: threads.staveFamilyId })
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1);

  if (threadRows.length === 0 || !threadRows[0].staveFamilyId) return [];
  const fid = threadRows[0].staveFamilyId;

  const rows = await db
    .select({
      id: threads.id,
      slug: threads.slug,
      title: threads.title,
      opBody: threads.opBody,
      format: threads.format,
      isAutoCreated: threads.isAutoCreated,
      category: threads.category,
      staveFamilyId: threads.staveFamilyId,
      staveSlug: staves.slug,
      authorId: threads.authorId,
      authorUsername: userProfiles.username,
      voteScore: threads.voteScore,
      commentsCount: threads.commentsCount,
      createdAt: threads.createdAt,
      lastActivityAt: threads.lastActivityAt,
      tags: threads.tags,
    })
    .from(threads)
    .leftJoin(userProfiles, eq(threads.authorId, userProfiles.userId))
    .leftJoin(
      staves,
      and(eq(threads.staveFamilyId, staves.id), isNull(staves.deletedAt)),
    )
    .where(
      and(
        eq(threads.staveFamilyId, fid),
        sql`${threads.id} != ${threadId}`,
        isNull(threads.deletedAt),
      ),
    )
    .orderBy(desc(threads.lastActivityAt))
    .limit(limit);

  return rows.map((r) => toFeedRow(r as Parameters<typeof toFeedRow>[0]));
}

export async function incrementThreadViews(threadId: string): Promise<void> {
  const db = getDbOptional();
  if (!db) return;
  await db
    .update(threads)
    .set({ viewsCount: sql`${threads.viewsCount} + 1` })
    .where(eq(threads.id, threadId))
    .catch(() => {});
}

export async function getAttachedStaveCard(
  staveFamilyId: string,
): Promise<{ slug: string; title: string; authorUsername: string | null } | null> {
  const db = getDbOptional();
  if (!db) return null;

  const rows = await db
    .select({
      slug: staves.slug,
      title: staves.title,
      authorUsername: userProfiles.username,
    })
    .from(staves)
    .leftJoin(userProfiles, eq(staves.authorId, userProfiles.userId))
    .where(and(eq(staves.id, staveFamilyId), isNull(staves.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;
  return {
    slug: rows[0].slug,
    title: rows[0].title,
    authorUsername: rows[0].authorUsername ?? null,
  };
}

/**
 * Returns true if the viewer is the author of the stave family for
 * the given auto-thread.
 */
export async function canEditOpBody(
  viewerId: string,
  threadId: string,
): Promise<boolean> {
  const db = getDb();

  const threadRows = await db
    .select({
      staveFamilyId: threads.staveFamilyId,
      isAutoCreated: threads.isAutoCreated,
    })
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1);

  if (threadRows.length === 0) return false;
  const thread = threadRows[0];
  if (!thread.isAutoCreated || !thread.staveFamilyId) return false;

  const staveRows = await db
    .select({ authorId: staves.authorId })
    .from(staves)
    .where(and(eq(staves.id, thread.staveFamilyId), isNull(staves.deletedAt)))
    .limit(1);

  if (staveRows.length === 0) return false;
  return staveRows[0].authorId === viewerId;
}
