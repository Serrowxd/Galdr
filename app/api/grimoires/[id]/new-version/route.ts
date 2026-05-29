import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { getGrimoireById, newVersionOfGrimoire } from "@/lib/grimoires";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const RATE = 20;
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

  const limited = enforceRateLimit(`grimoire-newver:${user.id}`, RATE, RATE_WINDOW_MS);
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
  // New versions branch off a frozen published release; edit drafts directly.
  if (grimoire.status !== "published") {
    return NextResponse.json({ error: "not_published" }, { status: 409 });
  }

  const { id: newId } = await newVersionOfGrimoire(db, grimoire);
  return NextResponse.json({ id: newId }, { status: 201 });
}
