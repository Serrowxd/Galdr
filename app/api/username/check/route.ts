import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDbOptional } from "@/db";
import { userProfiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

/** Returns whether the requesting user already has a username set. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ hasUsername: false });
  }

  try {
    const [profile] = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    return NextResponse.json({ hasUsername: Boolean(profile?.username) });
  } catch (err) {
    console.error("username check failed", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
