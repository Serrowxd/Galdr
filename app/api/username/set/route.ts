import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { createClient } from "@/lib/supabase/server";
import { claimUsername } from "@/lib/auth/claimUsername";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof payload === "object" && payload !== null && "username" in payload
    ? String((payload as { username: unknown }).username)
    : "";

  try {
    const result = await claimUsername(db, user.id, raw);
    if (!result.ok) {
      if (result.reason === "collision") {
        return NextResponse.json({ error: "Username taken.", collision: true }, { status: 409 });
      }
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("username set failed", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
