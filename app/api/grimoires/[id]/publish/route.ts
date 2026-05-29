import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { getGrimoireById, publishGrimoire } from "@/lib/grimoires";
import { generateUniqueGrimoireSlug, slugifyGrimoireTitle } from "@/lib/grimoireSlug";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
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

  const limited = enforceRateLimit(`grimoire-publish:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (grimoire.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (grimoire.status === "published") {
    return NextResponse.json({ error: "already_published" }, { status: 409 });
  }
  if (!grimoire.title.trim()) {
    return NextResponse.json({ error: "title is required to publish" }, { status: 400 });
  }

  let releaseNotes: string | null = null;
  try {
    const payload = (await request.json()) as { release_notes?: unknown };
    if (payload && typeof payload.release_notes === "string") {
      const trimmed = payload.release_notes.trim();
      if (trimmed.length > MAX_RELEASE_NOTES) {
        return NextResponse.json(
          { error: `release notes exceed ${MAX_RELEASE_NOTES} chars` },
          { status: 400 },
        );
      }
      releaseNotes = trimmed || null;
    }
  } catch {
    // Body is optional.
  }

  const slug = await generateUniqueGrimoireSlug(db, slugifyGrimoireTitle(grimoire.title));
  const result = await publishGrimoire(db, grimoire, slug, releaseNotes);

  if (!result.ok) {
    return NextResponse.json(
      { error: "required_entries_unavailable", entryIds: result.entryIds },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, slug, warnings: result.warnings });
}
