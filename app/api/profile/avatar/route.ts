import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { userProfiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * Persists the user's avatar URL onto their public profile row so any visitor
 * can render it (auth metadata is only readable for the current user). The
 * upload itself happens client-side against Supabase storage; this just mirrors
 * the resulting public URL into `user_profiles.avatar_url`.
 */
function isOwnAvatarUrl(url: string, userId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  // Only accept public URLs in this project's avatars bucket, scoped to the
  // caller's own folder (`<userId>/...`). Prevents pointing the profile at an
  // arbitrary or another user's object.
  const prefix = `${base.replace(/\/$/, "")}/storage/v1/object/public/avatars/${userId}/`;
  return url.startsWith(prefix);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = (typeof payload === "object" && payload !== null ? payload : {}) as {
    avatarUrl?: unknown;
  };
  const avatarUrl =
    typeof body.avatarUrl === "string" && body.avatarUrl.length > 0
      ? body.avatarUrl
      : null;

  if (avatarUrl !== null && !isOwnAvatarUrl(avatarUrl, user.id)) {
    return NextResponse.json({ error: "Invalid avatar URL." }, { status: 400 });
  }

  try {
    await db
      .update(userProfiles)
      .set({ avatarUrl })
      .where(eq(userProfiles.userId, user.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("avatar persist failed", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
