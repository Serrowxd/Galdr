import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { getStaveById, publishStave } from "@/lib/staves";
import { generateUniqueSlug, slugifyTitle } from "@/lib/staveSlug";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const MAX_RELEASE_NOTES = 500;
const RATE = 20;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(`stave-publish:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const stave = await getStaveById(db, id);
  if (!stave) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (stave.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (stave.status === "published") {
    return NextResponse.json({ error: "already_published" }, { status: 409 });
  }
  if (!stave.title.trim() || !stave.body.trim()) {
    return NextResponse.json(
      { error: "title and body are required to publish" },
      { status: 400 },
    );
  }

  let releaseNotes: string | null = null;
  let isPrivate = false;
  try {
    const payload = (await request.json()) as {
      releaseNotes?: unknown;
      private?: unknown;
    };
    if (payload && typeof payload.releaseNotes === "string") {
      const trimmed = payload.releaseNotes.trim();
      if (trimmed.length > MAX_RELEASE_NOTES) {
        return NextResponse.json(
          { error: `release notes exceed ${MAX_RELEASE_NOTES} chars` },
          { status: 400 },
        );
      }
      releaseNotes = trimmed || null;
    }
    if (payload && typeof payload.private === "boolean") {
      isPrivate = payload.private;
    }
  } catch {
    // Body is optional — ignore absent/invalid JSON.
  }

  const slug = await generateUniqueSlug(db, slugifyTitle(stave.title), stave.id);
  await publishStave(db, id, slug, releaseNotes, isPrivate);

  return NextResponse.json({ slug });
}
