import { redirect } from "next/navigation";

import { getDbOptional } from "@/db";
import { createGrimoire } from "@/lib/grimoires";
import { getUserProfileByUserId } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Entry point for a fresh grimoire: creates an empty draft server-side, then
// hands off to the editor (spec 07 page contract).
export default async function NewGrimoirePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/grimoires/new");

  const db = getDbOptional();
  if (!db) redirect("/registry");

  const profile = await getUserProfileByUserId(db, user.id);
  if (!profile) redirect("/settings");

  const { id } = await createGrimoire(db, {
    authorId: user.id,
    title: "Untitled grimoire",
  });

  redirect(`/grimoires/${id}/edit`);
}
