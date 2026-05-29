import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { getGrimoireById, reorderEntries } from "@/lib/grimoires";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

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

  const limited = enforceRateLimit(`grimoire-reorder:${user.id}`, RATE, RATE_WINDOW_MS);
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

  let payload: { positions?: unknown };
  try {
    payload = (await request.json()) as { positions?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !Array.isArray(payload.positions) ||
    !payload.positions.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { entryId?: unknown }).entryId === "string" &&
        typeof (p as { position?: unknown }).position === "number",
    )
  ) {
    return NextResponse.json(
      { error: "positions must be [{ entryId, position }]" },
      { status: 400 },
    );
  }

  const positions = payload.positions as { entryId: string; position: number }[];

  // Target positions must be distinct non-negative integers — otherwise the
  // two-pass reorder would collide on the (grimoire_id, position) unique
  // constraint and surface as a 500.
  const seen = new Set<number>();
  for (const p of positions) {
    if (!Number.isInteger(p.position) || p.position < 0 || seen.has(p.position)) {
      return NextResponse.json(
        { error: "positions must be distinct non-negative integers" },
        { status: 400 },
      );
    }
    seen.add(p.position);
  }

  const result = await reorderEntries(db, id, positions);
  if (!result.ok) {
    return NextResponse.json({ error: "must include every entry once" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
