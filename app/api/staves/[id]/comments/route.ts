import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { comments } from "@/db/schema";
import { listCommentsForStave } from "@/lib/staveEngagement";
import { isValidStaveId } from "@/lib/staves";

const MAX_LEN = 8000;

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
    comments: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

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

  const user = await currentUser();
  const authorLabel =
    user?.username ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress ??
    "Scribe";

  await db.insert(comments).values({
    staveId: id,
    clerkUserId: userId,
    authorLabel,
    body,
  });

  const rows = await listCommentsForStave(db, id, 80);
  return NextResponse.json({
    comments: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
