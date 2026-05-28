import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { forkStave, getStaveById } from "@/lib/staves";
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

  const limited = enforceRateLimit(`stave-fork:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const parent = await getStaveById(db, id);
  if (!parent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (parent.status !== "published") {
    return NextResponse.json({ error: "cannot_fork_draft" }, { status: 400 });
  }

  const { id: newId } = await forkStave(db, parent, user.id);
  return NextResponse.json({ id: newId });
}
