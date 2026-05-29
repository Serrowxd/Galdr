import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { getGrimoireById, toggleSavedGrimoire } from "@/lib/grimoires";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const RATE = 30;
const RATE_WINDOW_MS = 60_000;

export async function POST(_request: Request, context: Ctx) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(`grimoire-save:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire || grimoire.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { saved } = await toggleSavedGrimoire(db, user.id, id);
  return NextResponse.json({ ok: true, saved });
}
