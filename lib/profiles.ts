import { eq, sql } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { userProfiles } from "@/db/schema";

export type ProfileRow = {
  userId: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
};

const SELECT = {
  userId: userProfiles.userId,
  username: userProfiles.username,
  bio: userProfiles.bio,
  avatarUrl: userProfiles.avatarUrl,
};

/** Case-insensitive lookup by username (the public saga slug). */
export async function getUserProfileByUsername(
  db: GaldrDb,
  username: string,
): Promise<ProfileRow | null> {
  const [row] = await db
    .select(SELECT)
    .from(userProfiles)
    .where(sql`lower(${userProfiles.username}) = ${username.toLowerCase()}`)
    .limit(1);
  return row ?? null;
}

export async function getUserProfileByUserId(
  db: GaldrDb,
  userId: string,
): Promise<ProfileRow | null> {
  const [row] = await db
    .select(SELECT)
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}
