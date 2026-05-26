import { sql } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { userProfiles } from "@/db/schema";
import { validateUsernameInput } from "@/lib/clerkUsername";

export type ClaimUsernameResult =
  | { ok: true; username: string }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "collision" };

/**
 * Validate, collision-check (case-insensitive, excluding the caller), and upsert
 * a username into `user_profiles` for the given auth user. Shared by the
 * `/api/username/set` route and the `/auth/confirm` post-signup claim.
 */
export async function claimUsername(
  db: GaldrDb,
  userId: string,
  rawUsername: string,
): Promise<ClaimUsernameResult> {
  const validated = validateUsernameInput(rawUsername);
  if (!validated.ok) {
    return { ok: false, reason: "invalid", message: validated.message };
  }
  const username = validated.value;

  const [conflict] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(
      sql`lower(${userProfiles.username}) = lower(${username}) AND ${userProfiles.userId} != ${userId}`,
    )
    .limit(1);

  if (conflict) {
    return { ok: false, reason: "collision" };
  }

  await db
    .insert(userProfiles)
    .values({ userId, username })
    .onConflictDoUpdate({
      target: [userProfiles.userId],
      set: { username },
    });

  return { ok: true, username };
}
