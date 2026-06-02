import { and, desc, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import {
  grimoireDownloads,
  grimoireEntries,
  grimoireInclusionEvents,
  grimoireVotes,
  grimoires,
  savedGrimoires,
  staveFiles,
  staves,
  userProfiles,
  type Grimoire,
  type GrimoireEntry,
  type Stave,
} from "@/db/schema";
import { isUuid } from "@/lib/staves";

export type { Grimoire, GrimoireEntry } from "@/db/schema";

export type GrimoireStatus = "draft" | "published";

export type UserProfile = typeof userProfiles.$inferSelect;

/** Postgres unique-violation SQLSTATE — used to translate races into clean results. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

/** Reserved tag string that flips a grimoire into ORCHESTRATION mode (spec 07 #5). */
export const ORCHESTRATION_TAG = "orchestration";

/** Hard cap on entries per grimoire — enforced at the API layer (spec 07). */
export const MAX_ENTRIES = 50;

export type GrimoireWithMetrics = Grimoire & {
  upvotes: number;
  downvotes: number;
  staveCount: number;
  sourceCount: number;
  savesCount: number;
  monthlyScore: number;
  hasNewerVersion: boolean;
  authorUsername: string | null;
};

export type ListGrimoiresOpts = {
  status?: GrimoireStatus;
  authorId?: string;
  q?: string;
  tag?: string;
  sort?: "top" | "new";
  limit?: number;
  offset?: number;
  /** Only grimoires whose entry list contains a stave from this family. */
  containsStaveFamily?: string;
};

export type ListGrimoiresResult = {
  rows: GrimoireWithMetrics[];
  total: number;
};

export type GrimoireVersion = {
  version: number;
  slug: string;
  releaseNotes: string | null;
  publishedAt: Date | null;
};

export type ResolvedEntry = {
  entry: GrimoireEntry;
  resolved:
    | { status: "ok"; stave: Stave; author: UserProfile | null }
    | { status: "unavailable"; reason: "deleted" | "unpublished" | "family-empty" };
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getGrimoireById(
  db: GaldrDb,
  id: string,
): Promise<Grimoire | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(grimoires)
    .where(and(eq(grimoires.id, id), isNull(grimoires.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getGrimoireBySlug(
  db: GaldrDb,
  slug: string,
): Promise<Grimoire | null> {
  const [row] = await db
    .select()
    .from(grimoires)
    .where(and(eq(grimoires.slug, slug), isNull(grimoires.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function grimoireExists(db: GaldrDb, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const [row] = await db
    .select({ id: grimoires.id })
    .from(grimoires)
    .where(and(eq(grimoires.id, id), isNull(grimoires.deletedAt)))
    .limit(1);
  return Boolean(row);
}

export async function getGrimoiresByAuthor(
  db: GaldrDb,
  authorId: string,
  opts: { status?: GrimoireStatus } = {},
): Promise<Grimoire[]> {
  const conditions = [eq(grimoires.authorId, authorId), isNull(grimoires.deletedAt)];
  if (opts.status) conditions.push(eq(grimoires.status, opts.status));
  return db
    .select()
    .from(grimoires)
    .where(and(...conditions))
    .orderBy(desc(grimoires.version), desc(grimoires.createdAt));
}

export async function getGrimoiresByIds(
  db: GaldrDb,
  ids: string[],
): Promise<Grimoire[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(grimoires)
    .where(and(inArray(grimoires.id, ids), isNull(grimoires.deletedAt)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Grimoire => Boolean(r));
}

export async function getVersionsByFamily(
  db: GaldrDb,
  familyId: string,
): Promise<GrimoireVersion[]> {
  return db
    .select({
      version: grimoires.version,
      slug: grimoires.slug,
      releaseNotes: grimoires.releaseNotes,
      publishedAt: grimoires.publishedAt,
    })
    .from(grimoires)
    .where(
      and(
        eq(grimoires.familyId, familyId),
        eq(grimoires.status, "published"),
        isNull(grimoires.deletedAt),
      ),
    )
    .orderBy(desc(grimoires.version));
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

export type CreateGrimoireInput = {
  authorId: string;
  title: string;
  shortDescription?: string | null;
  details?: string | null;
  tags?: string[];
  license?: string;
};

export async function createGrimoire(
  db: GaldrDb,
  input: CreateGrimoireInput,
): Promise<{ id: string }> {
  // Option B: generate the id in-app so family_id can equal it in one insert.
  const id = crypto.randomUUID();
  await db.insert(grimoires).values({
    id,
    familyId: id,
    slug: `draft-${id.slice(0, 8)}`,
    authorId: input.authorId,
    title: input.title,
    shortDescription: input.shortDescription ?? null,
    details: input.details ?? null,
    tags: input.tags ?? [],
    license: input.license ?? "CC BY 4.0",
    status: "draft",
    version: 1,
  });
  return { id };
}

export type UpdateGrimoirePatch = Partial<{
  title: string;
  shortDescription: string | null;
  details: string | null;
  tags: string[];
  license: string;
}>;

/** Refuses to mutate a published row (immutable releases — see spec 03). */
export async function updateGrimoire(
  db: GaldrDb,
  id: string,
  patch: UpdateGrimoirePatch,
): Promise<{ ok: boolean; reason?: "not_found" | "published" }> {
  const existing = await getGrimoireById(db, id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status === "published") return { ok: false, reason: "published" };

  await db
    .update(grimoires)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(grimoires.id, id), isNull(grimoires.deletedAt)));
  return { ok: true };
}

/**
 * Soft-deletes a grimoire. When the row was published, emits one `removed`
 * inclusion event per current entry before flipping deleted_at (spec 07 #21).
 */
export async function softDeleteGrimoire(db: GaldrDb, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [g] = await tx
      .select()
      .from(grimoires)
      .where(and(eq(grimoires.id, id), isNull(grimoires.deletedAt)))
      .limit(1);
    if (!g) return;

    if (g.status === "published") {
      const entries = await tx
        .select()
        .from(grimoireEntries)
        .where(eq(grimoireEntries.grimoireId, id));
      const authors = await resolveFamilyAuthors(
        tx,
        entries.map((e) => e.staveFamilyId),
      );
      await emitInclusionEvents(
        tx,
        entries.map((e) => ({
          grimoireId: id,
          staveFamilyId: e.staveFamilyId,
          staveAuthorId: authors.get(e.staveFamilyId) ?? g.authorId,
          grimoireAuthorId: g.authorId,
          eventType: "removed" as const,
          grimoireVersion: g.version,
        })),
      );
    }

    await tx
      .update(grimoires)
      .set({ deletedAt: new Date() })
      .where(and(eq(grimoires.id, id), isNull(grimoires.deletedAt)));
  });
}

type GaldrTx = Parameters<Parameters<GaldrDb["transaction"]>[0]>[0];

async function copyEntries(
  tx: GaldrTx,
  fromGrimoireId: string,
  toGrimoireId: string,
): Promise<void> {
  const entries = await tx
    .select()
    .from(grimoireEntries)
    .where(eq(grimoireEntries.grimoireId, fromGrimoireId))
    .orderBy(grimoireEntries.position);
  if (entries.length === 0) return;
  await tx.insert(grimoireEntries).values(
    entries.map((e) => ({
      grimoireId: toGrimoireId,
      staveFamilyId: e.staveFamilyId,
      pinnedStaveId: e.pinnedStaveId,
      position: e.position,
      isOptional: e.isOptional,
      annotation: e.annotation,
    })),
  );
}

/** Creates a new-version draft within the parent's family. Copies entries. */
export async function newVersionOfGrimoire(
  db: GaldrDb,
  parent: Grimoire,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(grimoires).values({
      id,
      slug: `draft-${id.slice(0, 8)}`,
      authorId: parent.authorId,
      title: parent.title,
      shortDescription: parent.shortDescription,
      details: parent.details,
      tags: parent.tags,
      license: parent.license,
      status: "draft",
      version: parent.version + 1,
      familyId: parent.familyId,
      predecessorId: parent.id,
      forkedFrom: parent.forkedFrom,
    });
    await copyEntries(tx, parent.id, id);
  });
  return { id };
}

/** Forks a published grimoire into a new family owned by the caller. Copies entries. */
export async function forkGrimoire(
  db: GaldrDb,
  parent: Grimoire,
  userId: string,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(grimoires).values({
      id,
      familyId: id,
      slug: `draft-${id.slice(0, 8)}`,
      authorId: userId,
      title: `${parent.title} (fork)`,
      shortDescription: parent.shortDescription,
      details: parent.details,
      tags: parent.tags,
      license: parent.license,
      status: "draft",
      version: 1,
      predecessorId: null,
      forkedFrom: parent.id,
    });
    await copyEntries(tx, parent.id, id);
  });
  return { id };
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export async function getGrimoireEntries(
  db: GaldrDb,
  grimoireId: string,
): Promise<GrimoireEntry[]> {
  return db
    .select()
    .from(grimoireEntries)
    .where(eq(grimoireEntries.grimoireId, grimoireId))
    .orderBy(grimoireEntries.position);
}

export type AddEntryInput = {
  staveFamilyId: string;
  pinnedStaveId?: string | null;
  position?: number;
  isOptional?: boolean;
  annotation?: string | null;
};

export type AddEntryResult =
  | { ok: true; id: string }
  | { ok: false; reason: "too_many" | "position_taken" | "invalid_family" | "invalid_pin" };

/**
 * Appends (or inserts at an explicit position) an entry. Validates that the
 * target family has a live published stave and that any pin belongs to it.
 */
export async function addEntry(
  db: GaldrDb,
  grimoireId: string,
  input: AddEntryInput,
): Promise<AddEntryResult> {
  // Family must have ≥1 published, non-deleted stave at insert time.
  const [familyRow] = await db
    .select({ authorId: staves.authorId })
    .from(staves)
    .where(
      and(
        eq(staves.familyId, input.staveFamilyId),
        eq(staves.status, "published"),
        isNull(staves.deletedAt),
      ),
    )
    .limit(1);
  if (!familyRow) return { ok: false, reason: "invalid_family" };

  if (input.pinnedStaveId) {
    const [pin] = await db
      .select({ familyId: staves.familyId })
      .from(staves)
      .where(and(eq(staves.id, input.pinnedStaveId), isNull(staves.deletedAt)))
      .limit(1);
    if (!pin || pin.familyId !== input.staveFamilyId) {
      return { ok: false, reason: "invalid_pin" };
    }
  }

  const existing = await db
    .select({ position: grimoireEntries.position })
    .from(grimoireEntries)
    .where(eq(grimoireEntries.grimoireId, grimoireId));
  if (existing.length >= MAX_ENTRIES) return { ok: false, reason: "too_many" };

  let position = input.position;
  if (position == null) {
    position = existing.reduce((max, e) => Math.max(max, e.position), 0) + 1;
  } else if (existing.some((e) => e.position === position)) {
    return { ok: false, reason: "position_taken" };
  }

  const id = crypto.randomUUID();
  try {
    await db.insert(grimoireEntries).values({
      id,
      grimoireId,
      staveFamilyId: input.staveFamilyId,
      pinnedStaveId: input.pinnedStaveId ?? null,
      position,
      isOptional: input.isOptional ?? false,
      annotation: input.annotation ?? null,
    });
  } catch (e) {
    // Concurrent appends can compute the same max+1 position and race onto the
    // (grimoire_id, position) unique constraint. Surface a clean conflict rather
    // than a 500 so the client can retry.
    if (isUniqueViolation(e)) return { ok: false, reason: "position_taken" };
    throw e;
  }
  return { ok: true, id };
}

export type UpdateEntryPatch = Partial<{
  pinnedStaveId: string | null;
  isOptional: boolean;
  annotation: string | null;
}>;

export async function updateEntry(
  db: GaldrDb,
  grimoireId: string,
  entryId: string,
  patch: UpdateEntryPatch,
): Promise<void> {
  await db
    .update(grimoireEntries)
    .set(patch)
    .where(
      and(
        eq(grimoireEntries.id, entryId),
        eq(grimoireEntries.grimoireId, grimoireId),
      ),
    );
}

export async function removeEntry(
  db: GaldrDb,
  grimoireId: string,
  entryId: string,
): Promise<void> {
  await db
    .delete(grimoireEntries)
    .where(
      and(
        eq(grimoireEntries.id, entryId),
        eq(grimoireEntries.grimoireId, grimoireId),
      ),
    );
}

/**
 * Transactional batch reorder. Two-pass to dodge the (grimoire_id, position)
 * unique constraint mid-transaction: bump every row out of range first, then
 * assign the final positions.
 */
export async function reorderEntries(
  db: GaldrDb,
  grimoireId: string,
  positions: { entryId: string; position: number }[],
): Promise<{ ok: boolean; reason?: "mismatch" }> {
  return db.transaction(async (tx) => {
    const current = await tx
      .select({ id: grimoireEntries.id })
      .from(grimoireEntries)
      .where(eq(grimoireEntries.grimoireId, grimoireId));
    const currentIds = new Set(current.map((e) => e.id));
    const givenIds = new Set(positions.map((p) => p.entryId));
    if (
      currentIds.size !== givenIds.size ||
      [...currentIds].some((id) => !givenIds.has(id))
    ) {
      return { ok: false, reason: "mismatch" as const };
    }

    // Pass 1: shift everything well clear of any final value.
    for (const p of positions) {
      await tx
        .update(grimoireEntries)
        .set({ position: p.position + 10000 })
        .where(
          and(
            eq(grimoireEntries.id, p.entryId),
            eq(grimoireEntries.grimoireId, grimoireId),
          ),
        );
    }
    // Pass 2: settle to final positions.
    for (const p of positions) {
      await tx
        .update(grimoireEntries)
        .set({ position: p.position })
        .where(
          and(
            eq(grimoireEntries.id, p.entryId),
            eq(grimoireEntries.grimoireId, grimoireId),
          ),
        );
    }
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Entry resolution
// ---------------------------------------------------------------------------

/**
 * Resolves each entry against current stave state, ordered by position.
 * Soft-delete is honored regardless of pinning — there is no override path (spec 07 #15).
 */
export async function resolveGrimoireEntries(
  db: GaldrDb,
  grimoireId: string,
): Promise<ResolvedEntry[]> {
  const entries = await getGrimoireEntries(db, grimoireId);
  if (entries.length === 0) return [];

  const pinnedIds = entries
    .map((e) => e.pinnedStaveId)
    .filter((id): id is string => Boolean(id));
  const latestFamilyIds = entries
    .filter((e) => !e.pinnedStaveId)
    .map((e) => e.staveFamilyId);

  // Pinned staves: must be published + live.
  const pinnedRows = pinnedIds.length
    ? await db
        .select()
        .from(staves)
        .where(
          and(
            inArray(staves.id, pinnedIds),
            eq(staves.status, "published"),
            isNull(staves.deletedAt),
          ),
        )
    : [];
  const pinnedById = new Map(pinnedRows.map((s) => [s.id, s]));

  // Latest published per family.
  const latestByFamily = new Map<string, Stave>();
  if (latestFamilyIds.length) {
    const rows = await db
      .select()
      .from(staves)
      .where(
        and(
          inArray(staves.familyId, latestFamilyIds),
          eq(staves.status, "published"),
          isNull(staves.deletedAt),
        ),
      )
      .orderBy(desc(staves.version));
    for (const s of rows) {
      if (!latestByFamily.has(s.familyId)) latestByFamily.set(s.familyId, s);
    }
  }

  // Author lookup for resolved staves.
  const resolvedStaves = [...pinnedById.values(), ...latestByFamily.values()];
  const authorIds = [...new Set(resolvedStaves.map((s) => s.authorId))];
  const authorRows = authorIds.length
    ? await db
        .select()
        .from(userProfiles)
        .where(inArray(userProfiles.userId, authorIds))
    : [];
  const authorById = new Map(authorRows.map((a) => [a.userId, a]));

  return entries.map((entry) => {
    if (entry.pinnedStaveId) {
      const stave = pinnedById.get(entry.pinnedStaveId);
      if (!stave) {
        return { entry, resolved: { status: "unavailable", reason: "deleted" } };
      }
      return {
        entry,
        resolved: { status: "ok", stave, author: authorById.get(stave.authorId) ?? null },
      };
    }
    const stave = latestByFamily.get(entry.staveFamilyId);
    if (!stave) {
      return { entry, resolved: { status: "unavailable", reason: "family-empty" } };
    }
    return {
      entry,
      resolved: { status: "ok", stave, author: authorById.get(stave.authorId) ?? null },
    };
  });
}

// ---------------------------------------------------------------------------
// Publish + inclusion-event audit log
// ---------------------------------------------------------------------------

/** Pure set diff used by the new-version inclusion-event logic (spec 07 #21). */
export function computeFamilyDiff(
  prev: string[],
  next: string[],
): { added: string[]; removed: string[] } {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const added = [...nextSet].filter((f) => !prevSet.has(f));
  const removed = [...prevSet].filter((f) => !nextSet.has(f));
  return { added, removed };
}

async function resolveFamilyAuthors(
  tx: GaldrTx,
  familyIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(familyIds)];
  if (unique.length === 0) return new Map();
  // Any row in the family (even unpublished) gives us the author for the audit log.
  const rows = await tx
    .select({ familyId: staves.familyId, authorId: staves.authorId })
    .from(staves)
    .where(inArray(staves.familyId, unique))
    .orderBy(desc(staves.version));
  const out = new Map<string, string>();
  for (const r of rows) if (!out.has(r.familyId)) out.set(r.familyId, r.authorId);
  return out;
}

type InclusionEventInput = {
  grimoireId: string;
  staveFamilyId: string;
  staveAuthorId: string;
  grimoireAuthorId: string;
  eventType: "included" | "removed";
  grimoireVersion: number;
};

async function emitInclusionEvents(
  tx: GaldrTx,
  events: InclusionEventInput[],
): Promise<void> {
  if (events.length === 0) return;
  await tx.insert(grimoireInclusionEvents).values(events);
}

export type PublishGrimoireResult =
  | { ok: true; warnings: { entryId: string; reason: string }[] }
  | { ok: false; reason: "required_unavailable"; entryIds: string[] };

/**
 * Publishes a draft: validates entry resolution, locks the slug, stamps
 * published_at, and writes the inclusion-event audit log. Refuses (without
 * mutating) if any required entry is unavailable.
 */
export async function publishGrimoire(
  db: GaldrDb,
  grimoire: Grimoire,
  slug: string,
  releaseNotes: string | null,
): Promise<PublishGrimoireResult> {
  const resolved = await resolveGrimoireEntries(db, grimoire.id);

  const requiredUnavailable = resolved.filter(
    (r) => !r.entry.isOptional && r.resolved.status === "unavailable",
  );
  if (requiredUnavailable.length > 0) {
    return {
      ok: false,
      reason: "required_unavailable",
      entryIds: requiredUnavailable.map((r) => r.entry.id),
    };
  }

  const warnings = resolved
    .filter((r) => r.entry.isOptional && r.resolved.status === "unavailable")
    .map((r) => ({
      entryId: r.entry.id,
      reason: r.resolved.status === "unavailable" ? r.resolved.reason : "unknown",
    }));

  // Families that will be live in this published version (resolved-ok entries only).
  const nextFamilies = resolved
    .filter((r) => r.resolved.status === "ok")
    .map((r) => r.entry.staveFamilyId);
  const familyAuthor = new Map<string, string>();
  for (const r of resolved) {
    if (r.resolved.status === "ok") {
      familyAuthor.set(r.entry.staveFamilyId, r.resolved.stave.authorId);
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(grimoires)
      .set({
        status: "published",
        publishedAt: new Date(),
        slug,
        releaseNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(grimoires.id, grimoire.id), isNull(grimoires.deletedAt)));

    // Determine included/removed families relative to a published predecessor.
    let prevFamilies: string[] = [];
    if (grimoire.predecessorId) {
      const [pred] = await tx
        .select({ id: grimoires.id, status: grimoires.status })
        .from(grimoires)
        .where(eq(grimoires.id, grimoire.predecessorId))
        .limit(1);
      if (pred && pred.status === "published") {
        const predEntries = await tx
          .select({ staveFamilyId: grimoireEntries.staveFamilyId })
          .from(grimoireEntries)
          .where(eq(grimoireEntries.grimoireId, pred.id));
        prevFamilies = predEntries.map((e) => e.staveFamilyId);
      }
    }

    const { added, removed } = computeFamilyDiff(
      prevFamilies,
      [...new Set(nextFamilies)],
    );
    const includedFamilies = prevFamilies.length === 0 ? [...new Set(nextFamilies)] : added;

    const removedAuthors = await resolveFamilyAuthors(tx, removed);
    const events: InclusionEventInput[] = [
      ...includedFamilies.map((familyId) => ({
        grimoireId: grimoire.id,
        staveFamilyId: familyId,
        staveAuthorId: familyAuthor.get(familyId) ?? grimoire.authorId,
        grimoireAuthorId: grimoire.authorId,
        eventType: "included" as const,
        grimoireVersion: grimoire.version,
      })),
      ...removed.map((familyId) => ({
        grimoireId: grimoire.id,
        staveFamilyId: familyId,
        staveAuthorId: removedAuthors.get(familyId) ?? grimoire.authorId,
        grimoireAuthorId: grimoire.authorId,
        eventType: "removed" as const,
        grimoireVersion: grimoire.version,
      })),
    ];
    await emitInclusionEvents(tx, events);
  });

  return { ok: true, warnings };
}

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------

export async function setGrimoireVote(
  db: GaldrDb,
  userId: string,
  grimoireId: string,
  value: 1 | -1 | 0,
): Promise<void> {
  if (value === 0) {
    await db
      .delete(grimoireVotes)
      .where(
        and(eq(grimoireVotes.userId, userId), eq(grimoireVotes.grimoireId, grimoireId)),
      );
    return;
  }
  await db
    .insert(grimoireVotes)
    .values({ userId, grimoireId, value })
    .onConflictDoUpdate({
      target: [grimoireVotes.userId, grimoireVotes.grimoireId],
      set: { value, createdAt: new Date() },
    });
}

export async function toggleSavedGrimoire(
  db: GaldrDb,
  userId: string,
  grimoireId: string,
): Promise<{ saved: boolean }> {
  const [existing] = await db
    .select({ grimoireId: savedGrimoires.grimoireId })
    .from(savedGrimoires)
    .where(
      and(eq(savedGrimoires.userId, userId), eq(savedGrimoires.grimoireId, grimoireId)),
    )
    .limit(1);
  if (existing) {
    await db
      .delete(savedGrimoires)
      .where(
        and(
          eq(savedGrimoires.userId, userId),
          eq(savedGrimoires.grimoireId, grimoireId),
        ),
      );
    return { saved: false };
  }
  await db.insert(savedGrimoires).values({ userId, grimoireId });
  return { saved: true };
}

export async function getGrimoireVoteTotals(
  db: GaldrDb,
  grimoireId: string,
): Promise<{ upvotes: number; downvotes: number }> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE value > 0) AS up,
      COUNT(*) FILTER (WHERE value < 0) AS down
    FROM grimoire_votes WHERE grimoire_id = ${grimoireId}
  `);
  const row = (result as unknown as { up: number | string; down: number | string }[])[0];
  return { upvotes: Number(row?.up ?? 0), downvotes: Number(row?.down ?? 0) };
}

export async function getUserGrimoireVote(
  db: GaldrDb,
  grimoireId: string,
  userId: string,
): Promise<1 | -1 | 0> {
  const [row] = await db
    .select({ value: grimoireVotes.value })
    .from(grimoireVotes)
    .where(
      and(eq(grimoireVotes.grimoireId, grimoireId), eq(grimoireVotes.userId, userId)),
    )
    .limit(1);
  return (row?.value as 1 | -1 | undefined) ?? 0;
}

export async function isGrimoireSaved(
  db: GaldrDb,
  grimoireId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ grimoireId: savedGrimoires.grimoireId })
    .from(savedGrimoires)
    .where(
      and(eq(savedGrimoires.grimoireId, grimoireId), eq(savedGrimoires.userId, userId)),
    )
    .limit(1);
  return Boolean(row);
}

export async function listSavedGrimoireIds(
  db: GaldrDb,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ grimoireId: savedGrimoires.grimoireId })
    .from(savedGrimoires)
    .where(eq(savedGrimoires.userId, userId));
  return rows.map((r) => r.grimoireId);
}

/** Records a download and bumps the denormalized counter. */
/**
 * Records a grimoire download. Like staves, a signed-in user's repeat downloads of
 * the same grimoire within `dedupeWindowMs` are not re-counted (blunts ranking
 * gaming); anonymous downloads rely on the route rate limit. Returns true if a row
 * was inserted (and the denormalized counter bumped).
 */
export async function recordGrimoireDownload(
  db: GaldrDb,
  grimoireId: string,
  userId: string | null,
  dedupeWindowMs = 60 * 60 * 1000, // 1 hour
): Promise<boolean> {
  if (userId) {
    const since = new Date(Date.now() - dedupeWindowMs);
    const [recent] = await db
      .select({ id: grimoireDownloads.id })
      .from(grimoireDownloads)
      .where(
        and(
          eq(grimoireDownloads.grimoireId, grimoireId),
          eq(grimoireDownloads.userId, userId),
          gte(grimoireDownloads.downloadedAt, since),
        ),
      )
      .limit(1);
    if (recent) return false;
  }
  await db.transaction(async (tx) => {
    await tx.insert(grimoireDownloads).values({ grimoireId, userId });
    await tx
      .update(grimoires)
      .set({ downloadsCount: sql`${grimoires.downloadsCount} + 1` })
      .where(eq(grimoires.id, grimoireId));
  });
  return true;
}

export async function incrementGrimoireViews(
  db: GaldrDb,
  grimoireId: string,
): Promise<void> {
  await db
    .update(grimoires)
    .set({ viewsCount: sql`${grimoires.viewsCount} + 1` })
    .where(eq(grimoires.id, grimoireId));
}

/** Fork count across the whole family (spec 07 stats bar). */
export async function getGrimoireForkCount(
  db: GaldrDb,
  familyId: string,
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS n FROM grimoires
    WHERE forked_from IN (SELECT id FROM grimoires WHERE family_id = ${familyId})
      AND deleted_at IS NULL
  `);
  const rows = result as unknown as { n: number | string }[];
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// Download support
// ---------------------------------------------------------------------------

export async function getStaveFilesFor(
  db: GaldrDb,
  staveId: string,
): Promise<{ path: string; content: string }[]> {
  return db
    .select({ path: staveFiles.path, content: staveFiles.content })
    .from(staveFiles)
    .where(eq(staveFiles.staveId, staveId));
}

/**
 * Published grimoires whose entry list contains a stave from this family
 * (spec 08 "Found in grimoires" panel). `staveCount` is the grimoire's total
 * entry count, shown as a chip.
 */
export async function listGrimoiresContainingStave(
  db: GaldrDb,
  staveFamilyId: string,
): Promise<Array<{ slug: string; title: string; staveCount: number }>> {
  const result = await db.execute(sql`
    SELECT g.slug, g.title,
           (SELECT COUNT(*) FROM grimoire_entries e2 WHERE e2.grimoire_id = g.id) AS stave_count
    FROM grimoires g
    JOIN grimoire_entries ge
      ON ge.grimoire_id = g.id AND ge.stave_family_id = ${staveFamilyId}
    WHERE g.status = 'published' AND g.deleted_at IS NULL
    GROUP BY g.id, g.slug, g.title
    ORDER BY g.title
  `);
  const rows = result as unknown as {
    slug: string;
    title: string;
    stave_count: number | string;
  }[];
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    staveCount: Number(r.stave_count),
  }));
}

// ---------------------------------------------------------------------------
// Aggregate listing (mirrors lib/staves.ts listStaves — see spec 04 / 07)
// ---------------------------------------------------------------------------

type RawGrimoireMetricsRow = {
  id: string;
  slug: string;
  author_id: string;
  title: string;
  short_description: string | null;
  details: string | null;
  tags: string[];
  status: string;
  license: string;
  version: number;
  family_id: string;
  predecessor_id: string | null;
  forked_from: string | null;
  release_notes: string | null;
  views_count: number;
  downloads_count: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  deleted_at: Date | null;
  upvotes: number | string;
  downvotes: number | string;
  stave_count: number | string;
  source_count: number | string;
  saves_count: number | string;
  monthly_score: number | string;
  has_newer_version: boolean;
  author_username: string | null;
};

function mapMetricsRow(r: RawGrimoireMetricsRow): GrimoireWithMetrics {
  return {
    id: r.id,
    slug: r.slug,
    authorId: r.author_id,
    title: r.title,
    shortDescription: r.short_description,
    details: r.details,
    tags: r.tags ?? [],
    status: r.status,
    license: r.license,
    version: r.version,
    familyId: r.family_id,
    predecessorId: r.predecessor_id,
    forkedFrom: r.forked_from,
    releaseNotes: r.release_notes,
    viewsCount: r.views_count,
    downloadsCount: r.downloads_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
    deletedAt: r.deleted_at,
    upvotes: Number(r.upvotes),
    downvotes: Number(r.downvotes),
    staveCount: Number(r.stave_count),
    sourceCount: Number(r.source_count),
    savesCount: Number(r.saves_count),
    monthlyScore: Number(r.monthly_score),
    hasNewerVersion: Boolean(r.has_newer_version),
    authorUsername: r.author_username,
  };
}

export async function listGrimoires(
  db: GaldrDb,
  opts: ListGrimoiresOpts = {},
): Promise<ListGrimoiresResult> {
  const status = opts.status ?? "published";
  const limit = opts.limit ?? 24;
  const offset = opts.offset ?? 0;
  const sort = opts.sort ?? "top";

  const where: SQL[] = [sql`g.deleted_at IS NULL`, sql`g.status = ${status}`];
  if (opts.authorId) where.push(sql`g.author_id = ${opts.authorId}`);
  if (opts.q && opts.q.trim()) {
    const pattern = `%${opts.q.trim()}%`;
    where.push(sql`(g.title ILIKE ${pattern} OR g.short_description ILIKE ${pattern})`);
  }
  if (opts.tag) where.push(sql`${opts.tag} = ANY(g.tags)`);
  if (opts.containsStaveFamily) {
    where.push(
      sql`EXISTS (SELECT 1 FROM grimoire_entries ge WHERE ge.grimoire_id = g.id AND ge.stave_family_id = ${opts.containsStaveFamily})`,
    );
  }
  const whereSql = sql.join(where, sql` AND `);

  const orderSql =
    sort === "new"
      ? sql`g.published_at DESC NULLS LAST`
      : sql`monthly_score DESC, g.published_at DESC NULLS LAST`;

  const rowsResult = await db.execute(sql`
    WITH
      monthly_v AS (
        SELECT grimoire_id,
               COUNT(*) FILTER (WHERE value > 0) AS m_up,
               COUNT(*) FILTER (WHERE value < 0) AS m_down
        FROM grimoire_votes
        WHERE created_at >= now() - interval '30 days'
        GROUP BY grimoire_id
      ),
      monthly_d AS (
        SELECT grimoire_id, COUNT(*) AS m_dl
        FROM grimoire_downloads
        WHERE downloaded_at >= now() - interval '30 days'
        GROUP BY grimoire_id
      ),
      lifetime_v AS (
        SELECT grimoire_id,
               COUNT(*) FILTER (WHERE value > 0) AS up,
               COUNT(*) FILTER (WHERE value < 0) AS down
        FROM grimoire_votes
        GROUP BY grimoire_id
      ),
      entry_counts AS (
        SELECT grimoire_id, COUNT(*) AS stave_count
        FROM grimoire_entries
        GROUP BY grimoire_id
      ),
      source_counts AS (
        SELECT ge.grimoire_id, COUNT(DISTINCT s.author_id) AS source_count
        FROM grimoire_entries ge
        JOIN staves s ON s.family_id = ge.stave_family_id AND s.deleted_at IS NULL
        GROUP BY ge.grimoire_id
      ),
      save_counts AS (
        SELECT grimoire_id, COUNT(*) AS saves
        FROM saved_grimoires
        GROUP BY grimoire_id
      )
    SELECT g.*,
           COALESCE(lifetime_v.up, 0)   AS upvotes,
           COALESCE(lifetime_v.down, 0) AS downvotes,
           COALESCE(entry_counts.stave_count, 0) AS stave_count,
           COALESCE(source_counts.source_count, 0) AS source_count,
           COALESCE(save_counts.saves, 0) AS saves_count,
           up.username AS author_username,
           COALESCE(monthly_v.m_up, 0) - COALESCE(monthly_v.m_down, 0)
             + COALESCE(monthly_d.m_dl, 0) AS monthly_score,
           EXISTS (
             SELECT 1 FROM grimoires g2
             WHERE g2.family_id = g.family_id
               AND g2.version > g.version
               AND g2.deleted_at IS NULL
               AND g2.status = 'published'
           ) AS has_newer_version
    FROM grimoires g
    LEFT JOIN monthly_v    ON monthly_v.grimoire_id    = g.id
    LEFT JOIN monthly_d    ON monthly_d.grimoire_id    = g.id
    LEFT JOIN lifetime_v   ON lifetime_v.grimoire_id   = g.id
    LEFT JOIN entry_counts ON entry_counts.grimoire_id = g.id
    LEFT JOIN source_counts ON source_counts.grimoire_id = g.id
    LEFT JOIN save_counts ON save_counts.grimoire_id = g.id
    LEFT JOIN user_profiles up ON up.user_id = g.author_id
    WHERE ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM grimoires g WHERE ${whereSql}
  `);

  const rawRows = rowsResult as unknown as RawGrimoireMetricsRow[];
  const totalRow = (countResult as unknown as { total: number | string }[])[0];

  return {
    rows: rawRows.map(mapMetricsRow),
    total: Number(totalRow?.total ?? 0),
  };
}
