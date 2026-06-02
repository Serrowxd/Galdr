import { redirect } from "next/navigation";

import { getDbOptional } from "@/db";
import { staves } from "@/db/schema";
import { NewThreadPage } from "@/components/tavern/NewThreadPage";
import { createClient } from "@/lib/supabase/server";
import { and, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ attach?: string }>;

export default async function TavernNewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 1. Auth check — redirect anon users
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/tavern/new");
  }

  // 2. Resolve optional ?attach=<slug> param
  const sp = await searchParams;
  const attachSlug = sp.attach?.trim() ?? null;

  let attached: { staveFamilyId: string; staveSlug: string } | null = null;

  if (attachSlug) {
    const db = getDbOptional();
    if (db) {
      const rows = await db
        .select({ id: staves.id, familyId: staves.familyId, slug: staves.slug })
        .from(staves)
        .where(
          and(
            eq(staves.slug, attachSlug),
            eq(staves.status, "published"),
            isNull(staves.deletedAt),
          ),
        )
        .limit(1);

      if (rows.length > 0) {
        attached = {
          staveFamilyId: rows[0].familyId,
          staveSlug: rows[0].slug,
        };
      }
      // If not found → silently fall through to standalone (attached stays null)
    }
  }

  // 3. Render client form
  return (
    <div className="app-shell">
      <div className="container">
        <NewThreadPage userId={user.id} attached={attached} />
      </div>
    </div>
  );
}
