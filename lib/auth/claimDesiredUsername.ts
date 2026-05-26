import { eq } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GaldrDb } from "@/db";
import { userProfiles } from "@/db/schema";
import { claimUsername } from "@/lib/auth/claimUsername";

/**
 * Best-effort: after a confirmed email signup, claim the username the user chose
 * on the sign-up page (carried in `user_metadata.desired_username`). Only claims
 * when the user has no profile yet; any failure (taken/invalid/no DB) is swallowed
 * so the user simply falls back to the UsernameOnboardingModal on first load.
 */
export async function claimDesiredUsername(
  supabase: SupabaseClient,
  db: GaldrDb | null,
): Promise<void> {
  if (!db) return;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return;

  const desired = data.user.user_metadata?.desired_username;
  if (typeof desired !== "string" || !desired.trim()) return;

  const [existing] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, data.user.id))
    .limit(1);
  if (existing) return;

  await claimUsername(db, data.user.id, desired);
}
