import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { userProfiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { validateUsernameInput } from "@/lib/username";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("u") ?? searchParams.get("username") ?? "";

  const validated = validateUsernameInput(raw);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.message }, { status: 400 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const candidate = validated.value;

  try {
    // Case-insensitive exact match, excluding the requesting user's own profile
    const [conflict] = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(
        sql`lower(${userProfiles.username}) = lower(${candidate}) AND ${userProfiles.userId} != ${user.id}`,
      )
      .limit(1);

    return NextResponse.json({ available: !conflict });
  } catch (err) {
    console.error("username availability check failed", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
