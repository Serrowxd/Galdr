import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { grimoireSlugFromUsername } from "@/lib/grimoireSlug";

const DEMO_GRIMOIRE = "/grimoire/runehammer";

/** Signed-in users → their slug; signed-in without username → home; anon → demo grimoire. */
export default async function GrimoireIndexPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect(DEMO_GRIMOIRE);
  }

  const user = await currentUser();
  const slug =
    typeof user?.username === "string"
      ? grimoireSlugFromUsername(user.username)
      : null;

  if (slug) {
    redirect(`/grimoire/${slug}`);
  }

  redirect("/");
}
