import { and, eq } from "drizzle-orm";

import { getDbOptional } from "@/db";
import { commentVotes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = getDbOptional();
  if (!db) return new Response("DB unavailable", { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const value =
    typeof body === "object" &&
    body !== null &&
    "value" in body &&
    typeof (body as { value: unknown }).value === "number"
      ? (body as { value: number }).value
      : NaN;

  if (![-1, 0, 1].includes(value)) {
    return new Response("Bad value", { status: 400 });
  }

  if (value === 0) {
    await db
      .delete(commentVotes)
      .where(
        and(eq(commentVotes.userId, user.id), eq(commentVotes.commentId, id)),
      );
  } else {
    await db
      .insert(commentVotes)
      .values({ userId: user.id, commentId: id, value })
      .onConflictDoUpdate({
        target: [commentVotes.userId, commentVotes.commentId],
        set: { value, createdAt: new Date() },
      });
  }

  return Response.json({ ok: true });
}
