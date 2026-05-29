import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { getGrimoireById, setGrimoireVote } from "@/lib/grimoires";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const RATE = 30;
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

  const limited = enforceRateLimit(`grimoire-vote:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire || grimoire.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const value =
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { value: unknown }).value === "number"
      ? (payload as { value: number }).value
      : NaN;
  if (value !== 0 && value !== 1 && value !== -1) {
    return NextResponse.json({ error: "value must be -1, 0, or 1" }, { status: 400 });
  }

  await setGrimoireVote(db, user.id, id, value as 1 | -1 | 0);
  return NextResponse.json({ ok: true });
}
