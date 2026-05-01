import { and, count, desc, eq } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { comments, savedStaves, staveVotes } from "@/db/schema";

export async function getVoteTotals(db: GaldrDb, staveId: string) {
  const [upRow] = await db
    .select({ n: count() })
    .from(staveVotes)
    .where(and(eq(staveVotes.staveId, staveId), eq(staveVotes.value, 1)));

  const [downRow] = await db
    .select({ n: count() })
    .from(staveVotes)
    .where(and(eq(staveVotes.staveId, staveId), eq(staveVotes.value, -1)));

  return {
    upvotes: Number(upRow?.n ?? 0),
    downvotes: Number(downRow?.n ?? 0),
  };
}

export async function getCommentCount(db: GaldrDb, staveId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(comments)
    .where(eq(comments.staveId, staveId));
  return Number(row?.n ?? 0);
}

export async function getUserVote(
  db: GaldrDb,
  staveId: string,
  clerkUserId: string,
): Promise<1 | -1 | 0> {
  const [row] = await db
    .select({ value: staveVotes.value })
    .from(staveVotes)
    .where(
      and(eq(staveVotes.staveId, staveId), eq(staveVotes.clerkUserId, clerkUserId)),
    )
    .limit(1);
  if (!row) return 0;
  return row.value === -1 ? -1 : 1;
}

export async function isStaveSaved(
  db: GaldrDb,
  staveId: string,
  clerkUserId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ staveId: savedStaves.staveId })
    .from(savedStaves)
    .where(
      and(eq(savedStaves.staveId, staveId), eq(savedStaves.clerkUserId, clerkUserId)),
    )
    .limit(1);
  return Boolean(row);
}

export async function listCommentsForStave(
  db: GaldrDb,
  staveId: string,
  limit = 80,
) {
  return db
    .select({
      id: comments.id,
      authorLabel: comments.authorLabel,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(eq(comments.staveId, staveId))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
}

export async function listSavedStaveIds(db: GaldrDb, clerkUserId: string) {
  const rows = await db
    .select({ staveId: savedStaves.staveId })
    .from(savedStaves)
    .where(eq(savedStaves.clerkUserId, clerkUserId));
  return rows.map((r) => r.staveId);
}
