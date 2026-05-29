import type { ReactNode } from "react";
import Link from "next/link";

import { GrimoireCard } from "@/components/GrimoireCard";
import { StaveCard } from "@/components/StaveCard";
import { getDbOptional } from "@/db";
import {
  getGrimoiresByAuthor,
  getGrimoiresByIds,
  listSavedGrimoireIds,
  type Grimoire,
} from "@/lib/grimoires";
import { listSavedStaveIds } from "@/lib/staveEngagement";
import { createClient } from "@/lib/supabase/server";
import { getStavesByAuthor, getStavesByIds, type Stave } from "@/lib/staves";

export const dynamic = "force-dynamic";

function GrimoireShelf({
  title,
  hint,
  grimoires,
  action,
}: {
  title: string;
  hint: ReactNode;
  grimoires: Grimoire[];
  action?: ReactNode;
}) {
  return (
    <section className="library-shelf">
      <div className="section-head">
        <h2>{title}</h2>
        <span className="muted" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {grimoires.length} {grimoires.length === 1 ? "grimoire" : "grimoires"}
          {action}
        </span>
      </div>
      {grimoires.length === 0 ? (
        <p className="muted library-shelf-empty">{hint}</p>
      ) : (
        <div className="stave-grid">
          {grimoires.map((g) => (
            <GrimoireCard
              key={g.id}
              grimoire={{
                slug: g.slug,
                title: g.title,
                shortDescription: g.shortDescription,
                tags: g.tags,
                version: g.version,
                staveCount: 0,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Collapse a version chain to its latest published version per family. */
function latestPerFamily(staves: Stave[]): Stave[] {
  const byFamily = new Map<string, Stave>();
  for (const s of staves) {
    const current = byFamily.get(s.familyId);
    if (!current || s.version > current.version) byFamily.set(s.familyId, s);
  }
  return [...byFamily.values()].sort((a, b) => {
    const at = a.publishedAt ? a.publishedAt.getTime() : 0;
    const bt = b.publishedAt ? b.publishedAt.getTime() : 0;
    return bt - at;
  });
}

function Shelf({
  title,
  hint,
  staves,
}: {
  title: string;
  hint: ReactNode;
  staves: Stave[];
}) {
  return (
    <section className="library-shelf">
      <div className="section-head">
        <h2>{title}</h2>
        <span className="muted">
          {staves.length} {staves.length === 1 ? "stave" : "staves"}
        </span>
      </div>
      {staves.length === 0 ? (
        <p className="muted library-shelf-empty">{hint}</p>
      ) : (
        <div className="stave-grid">
          {staves.map((stave) => (
            <StaveCard key={stave.id} stave={stave} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = getDbOptional();

  let drafts: Stave[] = [];
  let published: Stave[] = [];
  let saved: Stave[] = [];
  let draftGrimoires: Grimoire[] = [];
  let savedGrimoires: Grimoire[] = [];
  if (user && db) {
    const [draftRows, publishedRows, savedIds, draftGrimoireRows, savedGrimoireIds] =
      await Promise.all([
        getStavesByAuthor(db, user.id, { status: "draft" }),
        getStavesByAuthor(db, user.id, { status: "published" }),
        listSavedStaveIds(db, user.id),
        getGrimoiresByAuthor(db, user.id, { status: "draft" }),
        listSavedGrimoireIds(db, user.id),
      ]);
    drafts = draftRows;
    published = latestPerFamily(publishedRows);
    saved = await getStavesByIds(db, savedIds);
    draftGrimoires = draftGrimoireRows;
    savedGrimoires = await getGrimoiresByIds(db, savedGrimoireIds);
  }

  return (
    <>
      <section className="page-hero" aria-labelledby="library-title">
        <div className="container">
          <p className="page-hero-tag">Your library</p>
          <h1 id="library-title" className="page-hero-title">
            Scrolls, drafts, and bookmarks.
          </h1>
          <p className="page-hero-sub">
            Your own shelf in the archive — staves you&apos;re drafting, the ones
            you&apos;ve published, and everything you&apos;ve saved from the registry.
          </p>
        </div>
      </section>

      <div className="container">
        {!user ? (
          <div style={{ paddingTop: 20, paddingBottom: 32 }}>
            <article className="empty-state" aria-live="polite">
              <h2>Sign in required</h2>
              <p>
                Use <strong>Sign in</strong> in the top bar to keep your drafts,
                published staves, and bookmarks here.
              </p>
            </article>
          </div>
        ) : (
          <div className="library-shelves">
            <Shelf
              title="Draft staves"
              staves={drafts}
              hint={
                <>
                  Staves you&apos;re working on appear here. Start one in the{" "}
                  <Link href="/loom">Loom</Link> or <Link href="/upload">import a .zip</Link>.
                </>
              }
            />
            <Shelf
              title="Published staves"
              staves={published}
              hint="Staves you've published to the registry show up here."
            />
            <Shelf
              title="Bookmarks"
              staves={saved}
              hint={
                <>
                  Open a stave in the <Link href="/">registry</Link> and choose{" "}
                  <strong>Save to library</strong> to bookmark it here.
                </>
              }
            />
            <GrimoireShelf
              title="Draft grimoires"
              grimoires={draftGrimoires}
              action={
                <Link href="/grimoires/new" className="btn btn-primary btn-sm">
                  Create Grimoire
                </Link>
              }
              hint={
                <>
                  Curate an ordered collection of staves. Start one at{" "}
                  <Link href="/grimoires/new">a new grimoire</Link>.
                </>
              }
            />
            <GrimoireShelf
              title="Saved grimoires"
              grimoires={savedGrimoires}
              hint={
                <>
                  Open a grimoire in the <Link href="/registry">registry</Link> and choose{" "}
                  <strong>Save</strong> to bookmark it here.
                </>
              }
            />
            <p className="muted" style={{ padding: "4px 0 24px" }}>
              <Link href="/saga">Your public saga →</Link>
            </p>
          </div>
        )}
      </div>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
        </div>
      </footer>
    </>
  );
}
