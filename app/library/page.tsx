import Link from "next/link";

import { StaveCard } from "@/components/StaveCard";
import { getDbOptional } from "@/db";
import type { Stave } from "@/lib/mockData";
import { listSavedStaveIds } from "@/lib/staveEngagement";
import { createClient } from "@/lib/supabase/server";
import { getStaveById } from "@/lib/staves";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = getDbOptional();

  let savedStaves: Stave[] = [];
  if (user && db) {
    const ids = await listSavedStaveIds(db, user.id);
    savedStaves = ids
      .map((id) => getStaveById(id))
      .filter((s): s is Stave => Boolean(s));
  }

  return (
    <>
      <section className="page-hero" aria-labelledby="library-title">
        <div className="container">
          <p className="page-hero-tag">Your library</p>
          <h1 id="library-title" className="page-hero-title">
            Saved staves.
          </h1>
          <p className="page-hero-sub">
            Bookmark staves from the registry to reopen rituals, bindings, and
            discussion threads from any session.
          </p>
        </div>
      </section>

      <div className="container">
        <div className="section-head">
          <h2>Bookmarks</h2>
          <span className="muted">
            {user ? `${savedStaves.length} saved staves` : "Sign in to save staves"}
          </span>
        </div>

        <div style={{ paddingTop: 20, paddingBottom: 32 }}>
          {!user ? (
            <article className="empty-state" aria-live="polite">
              <h2>Sign in required</h2>
              <p>
                Use <strong>Sign in</strong> in the top bar to bookmark staves from
                each stave page into your library.
              </p>
            </article>
          ) : savedStaves.length === 0 ? (
            <article className="empty-state" aria-live="polite">
              <h2>No saved staves yet</h2>
              <p>
                Browse the <Link href="/">Registry</Link>, open a stave, and choose{" "}
                <strong>Save to library</strong>.
              </p>
              <div className="empty-state-actions">
                <Link href="/" className="btn btn-soft btn-sm">
                  Browse registry
                </Link>
                <Link href="/loom" className="btn btn-primary btn-sm">
                  Open the Loom
                </Link>
              </div>
            </article>
          ) : (
            <div className="stave-grid">
              {savedStaves.map((stave) => (
                <StaveCard key={stave.id} stave={stave} />
              ))}
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
        </div>
      </footer>
    </>
  );
}
