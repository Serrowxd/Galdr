import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { addEntry, getGrimoireById } from "@/lib/grimoires";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const MAX_ANNOTATION = 1000;
const RATE = 60;
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

  const limited = enforceRateLimit(`grimoire-entry:${user.id}`, RATE, RATE_WINDOW_MS);
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
    return NextResponse.json({ error: "published" }, { status: 409 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload.stave_family_id !== "string") {
    return NextResponse.json({ error: "stave_family_id is required" }, { status: 400 });
  }
  if (
    payload.annotation != null &&
    (typeof payload.annotation !== "string" ||
      payload.annotation.length > MAX_ANNOTATION)
  ) {
    return NextResponse.json(
      { error: `annotation must be a string <= ${MAX_ANNOTATION} chars` },
      { status: 400 },
    );
  }

  const result = await addEntry(db, id, {
    staveFamilyId: payload.stave_family_id,
    pinnedStaveId:
      typeof payload.pinned_stave_id === "string" ? payload.pinned_stave_id : null,
    position: typeof payload.position === "number" ? payload.position : undefined,
    isOptional: payload.is_optional === true,
    annotation: typeof payload.annotation === "string" ? payload.annotation : null,
  });

  if (!result.ok) {
    const status =
      result.reason === "too_many" || result.reason === "position_taken" ? 409 : 422;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
