import { redirect } from "next/navigation";

import { getDbOptional } from "@/db";
import { sagaSlugFromUsername } from "@/lib/sagaSlug";
import { getUserProfileByUserId } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

/** Signed-in users → their saga; signed-in without username → home; anon → home. */
export default async function SagaIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const db = getDbOptional();
  if (db) {
    const profile = await getUserProfileByUserId(db, user.id);
    if (profile?.username) {
      const slug = sagaSlugFromUsername(profile.username);
      if (slug) redirect(`/saga/${slug}`);
    }
  }

  redirect("/");
}
