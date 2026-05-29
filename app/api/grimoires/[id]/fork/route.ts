import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { forkGrimoire, getGrimoireById } from "@/lib/grimoires";
import { getUserProfileByUserId } from "@/lib/profiles";
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

  const limited = enforceRateLimit(`grimoire-fork:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const profile = await getUserProfileByUserId(db, user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Set up your profile (username) before forking." },
      { status: 400 },
    );
  }

  const grimoire = await getGrimoireById(db, id);
  // Only published grimoires are forkable (drafts are private to their author).
  if (!grimoire || grimoire.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id: newId } = await forkGrimoire(db, grimoire, user.id);
  return NextResponse.json({ id: newId }, { status: 201 });
}
