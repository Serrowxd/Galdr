import Link from "next/link";

import { RegistryControls } from "@/app/registry/RegistryControls";
import { StaveCard } from "@/components/StaveCard";
import { getDbOptional } from "@/db";
import { getTopScribes, getTrendingTags, listStaves } from "@/lib/staves";

export const dynamic = "force-dynamic";

const LIMIT = 24;

type SearchParams = Promise<{
  q?: string;
  tag?: string;
  sort?: string;
  page?: string;
}>;

export default async function RegistryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const db = getDbOptional();

  if (!db) {
    return (
      <div className="container" style={{ padding: "48px 0" }}>
        <p className="muted">The registry is unavailable right now.</p>
      </div>
    );
  }

  const q = sp.q?.trim() || undefined;
  const tag = sp.tag && sp.tag !== "all" ? sp.tag : undefined;
  const sort = sp.sort === "new" ? "new" : "top";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [{ rows, total }, trendingTags, topScribes] = await Promise.all([
    listStaves(db, {
      status: "published",
      q,
      tag,
      sort,
      limit: LIMIT,
      offset: (page - 1) * LIMIT,
    }),
    getTrendingTags(db),
    getTopScribes(db),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const allTags = trendingTags.map((t) => t.tag);

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (sort !== "top") params.set("sort", sort);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/registry?${qs}` : "/registry";
  };

  return (
    <>
      <section className="page-hero" aria-labelledby="registry-title">
        <div className="container">
          <p className="page-hero-tag">Browse the registry</p>
          <h1 id="registry-title" className="page-hero-title">
            Every stave. Every scribe.
          </h1>
          <p className="page-hero-sub">
            Filter by tag, search by intent, and rank by what the community is
            running this month.
          </p>
        </div>
      </section>

      <div className="container">
        <RegistryControls allTags={allTags} />

        <div className="section-head">
          <h2>Featured feed</h2>
          <span className="muted">{total} staves</span>
        </div>

        <div className="col-grid" style={{ paddingTop: 16 }}>
          <div>
            {rows.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <p className="muted">
                  {total === 0 && !q && !tag
                    ? "Nothing here yet."
                    : "No staves match this search."}
                </p>
                <p className="muted">
                  {total === 0 && !q && !tag ? (
                    <Link href="/loom">Open the Loom →</Link>
                  ) : (
                    <Link href="/registry">Clear filters</Link>
                  )}
                </p>
              </div>
            ) : (
              <>
                <div className="stave-grid">
                  {rows.map((stave) => (
                    <StaveCard key={stave.id} stave={stave} />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div
                    className="filters"
                    style={{ marginTop: 24, justifyContent: "center" }}
                    aria-label="Pagination"
                  >
                    {page > 1 ? (
                      <Link href={pageHref(page - 1)} className="chip">
                        ← Prev
                      </Link>
                    ) : (
                      <span className="chip" aria-disabled>
                        ← Prev
                      </span>
                    )}
                    <span className="filters-label">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages ? (
                      <Link href={pageHref(page + 1)} className="chip">
                        Next →
                      </Link>
                    ) : (
                      <span className="chip" aria-disabled>
                        Next →
                      </span>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>

          <aside className="stack" style={{ gap: 16 }}>
            <section className="side-card">
              <h3 className="side-card-title">Trending tags</h3>
              <div className="side-card-tags">
                {trendingTags.map(({ tag: t, count }) => (
                  <Link key={t} href={`/registry?tag=${t}`} className="tag">
                    {t} <span className="chip-count">{count}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="side-card">
              <h3 className="side-card-title">Top scribes</h3>
              <ul className="side-card-list">
                {topScribes.map((scribe) => (
                  <li key={scribe.userId}>
                    <Link href={`/saga/${scribe.username.toLowerCase()}`}>
                      {scribe.username}
                    </Link>
                    <small>{scribe.staveCount} staves</small>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
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
