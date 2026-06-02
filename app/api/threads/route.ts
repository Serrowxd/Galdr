import { getDbOptional } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { createThread, RateLimitError, ValidationError } from "@/lib/threads";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const db = getDbOptional();
  if (!db) return new Response("DB unavailable", { status: 503 });

  const body = await req.json();
  const { title, opBody, format, category, staveFamilyId, tags } = body;

  // Parse tags from JSON string if needed
  let parsedTags: string[] = [];
  try {
    parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags ?? "[]");
  } catch {
    parsedTags = [];
  }

  try {
    const result = await createThread({
      authorId: user.id,
      title: String(title ?? ""),
      opBody: String(opBody ?? ""),
      format: format === "documentation" ? "documentation" : "discussion",
      category: category ?? null,
      staveFamilyId: staveFamilyId ?? null,
      tags: parsedTags,
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof RateLimitError)
      return new Response("Rate limit exceeded", { status: 429 });
    if (err instanceof ValidationError)
      return new Response((err as Error).message, { status: 400 });
    throw err;
  }
}
