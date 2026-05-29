import { LibraryClient } from "@/app/library/LibraryClient";
import { getDbOptional } from "@/db";
import { getLibraryGrimoires, getLibraryStaves } from "@/lib/library";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = getDbOptional();

  const [staves, grimoires] =
    user && db
      ? await Promise.all([
          getLibraryStaves(db, user.id),
          getLibraryGrimoires(db, user.id),
        ])
      : [[], []];

  return (
    <>
      {!user ? (
        <div className="container" style={{ paddingTop: 28 }}>
          <div style={{ paddingTop: 20, paddingBottom: 32 }}>
            <article className="empty-state" aria-live="polite">
              <h2>Sign in required</h2>
              <p>
                Use <strong>Sign in</strong> in the top bar to keep your drafts,
                published staves, and bookmarks here.
              </p>
            </article>
          </div>
        </div>
      ) : (
        <div className="lib-page">
          <LibraryClient staves={staves} grimoires={grimoires} />
        </div>
      )}

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
        </div>
      </footer>
    </>
  );
}
