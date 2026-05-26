import { sql } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { userProfiles } from "@/db/schema";
import { validateUsernameInput } from "@/lib/username";

export type ClaimUsernameResult =
  | { ok: true; username: string }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "collision" };

export const BIO_MAX_LENGTH = 280;

/** Trim and cap a raw bio value. Returns null for empty input (clears the bio). */
export function normalizeBio(raw: string): string | null {
  const trimmed = raw.trim().slice(0, BIO_MAX_LENGTH);
  return trimmed.length ? trimmed : null;
}

/**
 * Validate, collision-check (case-insensitive, excluding the caller), and upsert
 * a username into `user_profiles` for the given auth user. Shared by the
 * `/api/username/set` route and the `/auth/confirm` post-signup claim.
 *
 * When `bio` is provided it is normalized and upserted alongside the username;
 * when omitted (signup-confirm / onboarding) the bio column is left untouched.
 */
export async function claimUsername(
  db: GaldrDb,
  userId: string,
  rawUsername: string,
  rawBio?: string | null,
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

  const includeBio = rawBio !== undefined;
  const bio = includeBio ? normalizeBio(rawBio ?? "") : undefined;

  await db
    .insert(userProfiles)
    .values(includeBio ? { userId, username, bio } : { userId, username })
    .onConflictDoUpdate({
      target: [userProfiles.userId],
      set: includeBio ? { username, bio } : { username },
    });

  return { ok: true, username };
}
