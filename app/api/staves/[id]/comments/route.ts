import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { comments, userProfiles } from "@/db/schema";
import { getCommentCount, listCommentsForStave } from "@/lib/staveEngagement";
import { createClient } from "@/lib/supabase/server";
import { isValidStaveId } from "@/lib/staves";
import { rateLimit } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";

const MAX_LEN = 8000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function tooManyRequests(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidStaveId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ comments: [] });
  }

  const rows = await listCommentsForStave(db, id);
  return NextResponse.json({
    comments: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`comments:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfterMs);
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

  const body =
    typeof payload === "object" &&
    payload !== null &&
    "body" in payload &&
    typeof (payload as { body: unknown }).body === "string"
      ? (payload as { body: string }).body.trim()
      : "";

  if (!body.length) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }
  if (body.length > MAX_LEN) {
    return NextResponse.json({ error: "Body too long" }, { status: 400 });
  }

  // Resolve display name: prefer stored username, fall back to email local-part
  const [profile] = await db
    .select({ username: userProfiles.username })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const emailLocal = user.email?.split("@")[0] ?? "";
  const authorLabel = (profile?.username ?? emailLocal) || "Scribe";

  await db.insert(comments).values({
    staveId: id,
    userId: user.id,
    authorLabel,
    body,
  });

  const [rows, count] = await Promise.all([
    listCommentsForStave(db, id, 80),
    getCommentCount(db, id),
  ]);
  return NextResponse.json({
    comments: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    count,
  });
}
