import { eq, isNull, and } from "drizzle-orm";

import { getDbOptional } from "@/db";
import { threads, threadComments } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = getDbOptional();
  if (!db) return new Response("DB unavailable", { status: 503 });

  // Validate thread exists and is not deleted / locked
  const threadRows = await db
    .select({ status: threads.status })
    .from(threads)
    .where(and(eq(threads.id, id), isNull(threads.deletedAt)))
    .limit(1);

  if (threadRows.length === 0) return new Response("Not found", { status: 404 });
  if (threadRows[0].status === "locked")
    return new Response("Thread is locked", { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const rawBody = typeof (body as Record<string, unknown>).body === "string"
    ? ((body as Record<string, unknown>).body as string).trim()
    : "";
  const replyTo = typeof (body as Record<string, unknown>).replyTo === "string"
    ? ((body as Record<string, unknown>).replyTo as string)
    : null;

  if (!rawBody) return new Response("Body is required", { status: 422 });
  if (rawBody.length > 16384) return new Response("Too large", { status: 413 });

  // Validate replyTo exists and belongs to this thread
  if (replyTo) {
    const parentRows = await db
      .select({ id: threadComments.id })
      .from(threadComments)
      .where(
        and(
          eq(threadComments.id, replyTo),
          eq(threadComments.threadId, id),
          isNull(threadComments.deletedAt),
        ),
      )
      .limit(1);
    if (parentRows.length === 0)
      return new Response("Parent comment not found", { status: 422 });
  }

  const [inserted] = await db
    .insert(threadComments)
    .values({
      threadId: id,
      authorId: user.id,
      body: rawBody,
      replyTo: replyTo ?? undefined,
    })
    .returning({ id: threadComments.id });

  return Response.json({ id: inserted.id }, { status: 201 });
}
