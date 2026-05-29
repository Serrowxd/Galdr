import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  GrimoireEditorClient,
  type EditorEntry,
} from "@/components/grimoires/GrimoireEditorClient";
import { getDbOptional } from "@/db";
import { getGrimoireById, resolveGrimoireEntries } from "@/lib/grimoires";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The dynamic segment is named `slug` to match the sibling detail route
// (`/grimoires/[slug]`) — Next.js requires one param name per path position —
// but the editor addresses a grimoire by its uuid, so this value IS the id.
type PageProps = { params: Promise<{ slug: string }> };

export default async function GrimoireEditPage({ params }: PageProps) {
  const { slug: id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/grimoires/${id}/edit`);

  const db = getDbOptional();
  if (!db) notFound();

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire || grimoire.authorId !== user.id) notFound();
  // Published releases are immutable — view them on the public page; new edits
  // start from a new-version draft.
  if (grimoire.status === "published") redirect(`/grimoires/${grimoire.slug}`);

  const resolved = await resolveGrimoireEntries(db, id);
  const entries: EditorEntry[] = resolved.map((r) => ({
    id: r.entry.id,
    staveFamilyId: r.entry.staveFamilyId,
    isOptional: r.entry.isOptional,
    annotation: r.entry.annotation,
    pinned: Boolean(r.entry.pinnedStaveId),
    staveTitle:
      r.resolved.status === "ok" ? r.resolved.stave.title : "(unavailable stave)",
    staveSlug: r.resolved.status === "ok" ? r.resolved.stave.slug : null,
    staveVersion: r.resolved.status === "ok" ? r.resolved.stave.version : null,
    authorUsername: r.resolved.status === "ok" ? r.resolved.author?.username ?? null : null,
  }));

  return (
    <section className="container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/registry">Registry</Link>
        <span className="breadcrumb-sep" aria-hidden>
          /
        </span>
        <span>Edit grimoire</span>
      </nav>

      <GrimoireEditorClient
        id={grimoire.id}
        initialTitle={grimoire.title}
        initialShortDescription={grimoire.shortDescription ?? ""}
        initialDetails={grimoire.details ?? ""}
        initialLicense={grimoire.license}
        initialTags={grimoire.tags}
        initialEntries={entries}
      />
    </section>
  );
}
