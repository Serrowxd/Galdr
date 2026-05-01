import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { staveVotes } from "@/db/schema";
import { getVoteTotals, getUserVote } from "@/lib/staveEngagement";
import { isValidStaveId } from "@/lib/staves";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isValidStaveId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw =
    typeof payload === "object" &&
    payload !== null &&
    "value" in payload &&
    typeof (payload as { value: unknown }).value === "number"
      ? (payload as { value: number }).value
      : NaN;

  if (raw !== 0 && raw !== 1 && raw !== -1) {
    return NextResponse.json({ error: "value must be -1, 0, or 1" }, { status: 400 });
  }

  if (raw === 0) {
    await db
      .delete(staveVotes)
      .where(
        and(eq(staveVotes.clerkUserId, userId), eq(staveVotes.staveId, id)),
      );
  } else {
    await db
      .insert(staveVotes)
      .values({
        clerkUserId: userId,
        staveId: id,
        value: raw,
      })
      .onConflictDoUpdate({
        target: [staveVotes.clerkUserId, staveVotes.staveId],
        set: { value: raw },
      });
  }

  const totals = await getVoteTotals(db, id);
  const userVote = await getUserVote(db, id, userId);

  return NextResponse.json({
    ...totals,
    userVote,
  });
}
