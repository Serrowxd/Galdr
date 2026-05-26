import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDbOptional } from "@/db";
import { userProfiles } from "@/db/schema";
import { grimoireSlugFromUsername } from "@/lib/grimoireSlug";
import { createClient } from "@/lib/supabase/server";

const DEMO_GRIMOIRE = "/grimoire/runehammer";

/** Signed-in users → their slug; signed-in without username → home; anon → demo grimoire. */
export default async function GrimoireIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(DEMO_GRIMOIRE);
  }

  const db = getDbOptional();
  let username: string | null = null;
  if (db) {
    const [profile] = await db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);
    username = profile?.username ?? null;
  }

  if (username) {
    redirect(`/grimoire/${grimoireSlugFromUsername(username)}`);
  }

  redirect("/");
}
