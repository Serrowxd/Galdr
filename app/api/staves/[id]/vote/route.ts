import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { staveVotes } from "@/db/schema";
import { getVoteTotals, getUserVote } from "@/lib/staveEngagement";
import { createClient } from "@/lib/supabase/server";
import { isValidStaveId } from "@/lib/staves";
import { rateLimit } from "@/lib/rateLimit";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`vote:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
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
      .where(and(eq(staveVotes.userId, user.id), eq(staveVotes.staveId, id)));
  } else {
    await db
      .insert(staveVotes)
      .values({ userId: user.id, staveId: id, value: raw })
      .onConflictDoUpdate({
        target: [staveVotes.userId, staveVotes.staveId],
        set: { value: raw },
      });
  }

  const totals = await getVoteTotals(db, id);
  const userVote = await getUserVote(db, id, user.id);

  return NextResponse.json({ ...totals, userVote });
}
