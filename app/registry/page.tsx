import Link from "next/link";

import { RegistryControls } from "@/app/registry/RegistryControls";
import { RegistryTypeTabs } from "@/app/registry/RegistryTypeTabs";
import { GrimoireCard } from "@/components/GrimoireCard";
import { StaveCard } from "@/components/StaveCard";
import { getDbOptional } from "@/db";
import { listGrimoires } from "@/lib/grimoires";
import { getTopScribes, getTrendingTags, listStaves } from "@/lib/staves";

export const dynamic = "force-dynamic";

const LIMIT = 24;

type FeedItem =
  | { kind: "stave"; id: string; publishedAt: number; monthlyScore: number; data: import("@/lib/staves").StaveWithMetrics }
  | { kind: "grimoire"; id: string; publishedAt: number; monthlyScore: number; data: import("@/lib/grimoires").GrimoireWithMetrics };

type SearchParams = Promise<{
  q?: string;
  tag?: string;
  sort?: string;
  type?: string;
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
  const type = sp.type === "stave" || sp.type === "grimoire" ? sp.type : "all";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const offset = (page - 1) * LIMIT;

  const wantStaves = type !== "grimoire";
  const wantGrimoires = type !== "stave";

  // Both pools are queried so every tab can show an accurate count; the feed itself
  // is filtered by `type`. For the merged "all" view we merge-sort client-side and
  // report an approximate combined total (spec 07 #10 caveat).
  const [staveResult, grimoireResult, trendingTags, topScribes] = await Promise.all([
    listStaves(db, { status: "published", q, tag, sort, limit: LIMIT, offset }),
    listGrimoires(db, { status: "published", q, tag, sort, limit: LIMIT, offset }),
    getTrendingTags(db),
    getTopScribes(db),
  ]);

  const items: FeedItem[] = [
    ...(wantStaves ? staveResult.rows : []).map((s) => ({
      kind: "stave" as const,
      id: s.id,
      publishedAt: s.publishedAt ? new Date(s.publishedAt).getTime() : 0,
      monthlyScore: s.monthlyScore,
      data: s,
    })),
    ...(wantGrimoires ? grimoireResult.rows : []).map((g) => ({
      kind: "grimoire" as const,
      id: g.id,
      publishedAt: g.publishedAt ? new Date(g.publishedAt).getTime() : 0,
      monthlyScore: g.monthlyScore,
      data: g,
    })),
  ];

  items.sort((a, b) =>
    sort === "new"
      ? b.publishedAt - a.publishedAt
      : b.monthlyScore - a.monthlyScore || b.publishedAt - a.publishedAt,
  );
  const feed = type === "all" ? items.slice(0, LIMIT) : items;

  const staveTotal = staveResult.total;
  const grimoireTotal = grimoireResult.total;
  const allTotal = staveTotal + grimoireTotal;
  const total =
    type === "stave" ? staveTotal : type === "grimoire" ? grimoireTotal : allTotal;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const allTags = trendingTags.map((t) => t.tag);

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (sort !== "top") params.set("sort", sort);
    if (type !== "all") params.set("type", type);
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
        <RegistryTypeTabs
          counts={{ all: allTotal, stave: staveTotal, grimoire: grimoireTotal }}
        />

        <div className="section-head">
          <h2>Featured feed</h2>
          <span className="muted">{total} entries</span>
        </div>

        <div className="col-grid" style={{ paddingTop: 16 }}>
          <div>
            {feed.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <p className="muted">
                  {total === 0 && !q && !tag
                    ? "Nothing here yet."
                    : "No entries match this search."}
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
                  {feed.map((item) =>
                    item.kind === "stave" ? (
                      <StaveCard key={`s-${item.id}`} stave={item.data} />
                    ) : (
                      <GrimoireCard
                        key={`g-${item.id}`}
                        grimoire={{
                          slug: item.data.slug,
                          title: item.data.title,
                          shortDescription: item.data.shortDescription,
                          tags: item.data.tags,
                          version: item.data.version,
                          staveCount: item.data.staveCount,
                          sourceCount: item.data.sourceCount,
                          upvotes: item.data.upvotes,
                          downvotes: item.data.downvotes,
                          downloadsCount: item.data.downloadsCount,
                        }}
                      />
                    ),
                  )}
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
