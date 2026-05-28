import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { savedStaves } from "@/db/schema";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";
import { publishedStaveExists } from "@/lib/staves";

const RATE = 30;
const RATE_WINDOW_MS = 60_000;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(`save:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const { id } = await context.params;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Only published staves can be saved — drafts are private to their author.
  if (!(await publishedStaveExists(db, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .insert(savedStaves)
    .values({ userId: user.id, staveId: id })
    .onConflictDoNothing();

  return NextResponse.json({ saved: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(`save:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const { id } = await context.params;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  // Removing a bookmark always works, even if the stave was later unpublished or
  // soft-deleted — otherwise stale saves would be stuck in the user's library.
  await db
    .delete(savedStaves)
    .where(and(eq(savedStaves.userId, user.id), eq(savedStaves.staveId, id)));

  return NextResponse.json({ saved: false });
}
