import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { userProfiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { claimUsername } from "@/lib/auth/claimUsername";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const [profile] = await db
    .select({ username: userProfiles.username, bio: userProfiles.bio })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  return NextResponse.json({
    username: profile?.username ?? null,
    bio: profile?.bio ?? null,
  });
}

export async function PATCH(request: Request) {
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

  const body = (typeof payload === "object" && payload !== null ? payload : {}) as {
    username?: unknown;
    bio?: unknown;
  };
  const username = typeof body.username === "string" ? body.username : "";
  const bio = typeof body.bio === "string" ? body.bio : "";

  const result = await claimUsername(db, user.id, username, bio);
  if (!result.ok) {
    if (result.reason === "collision") {
      return NextResponse.json({ error: "Username taken.", collision: true }, { status: 409 });
    }
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
