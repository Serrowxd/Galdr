import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { StaveCard } from "@/components/StaveCard";
import { getDbOptional } from "@/db";
import type { Stave } from "@/lib/mockData";
import { listSavedStaveIds } from "@/lib/staveEngagement";
import { getStaveById } from "@/lib/staves";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const { userId } = await auth();
  const db = getDbOptional();

  let savedStaves: Stave[] = [];
  if (userId && db) {
    const ids = await listSavedStaveIds(db, userId);
    savedStaves = ids
      .map((id) => getStaveById(id))
      .filter((s): s is Stave => Boolean(s));
  }

  return (
    <section className="container page-block panel-stack">
      <div className="section-head">
        <h1 className="section-title">Library</h1>
        <span className="muted">
          {userId ? `${savedStaves.length} saved staves` : "Sign in to save staves"}
        </span>
      </div>

      <p className="library-intro muted">
        Saved staves sync to your account so you can reopen rituals, bindings, and
        discussion threads from any session.
      </p>

      {!userId ? (
        <article className="library-empty-state" aria-live="polite">
          <h2>Sign in required</h2>
          <p>
            Use <strong>Sign in</strong> in the header to bookmark staves from each
            stave page into your library.
          </p>
        </article>
      ) : savedStaves.length === 0 ? (
        <article className="library-empty-state" aria-live="polite">
          <h2>No saved staves yet</h2>
          <p>
            Browse the{" "}
            <Link href="/registry">Registry</Link>, open a stave, and choose{" "}
            <strong>Save to library</strong>.
          </p>
        </article>
      ) : (
        <div className="stave-grid">
          {savedStaves.map((stave) => (
            <StaveCard key={stave.id} stave={stave} />
          ))}
        </div>
      )}
    </section>
  );
}
