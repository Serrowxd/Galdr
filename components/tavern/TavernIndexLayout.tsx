import Link from "next/link";

import type { ThreadFeedRow } from "@/lib/threads";
import { FeedList } from "./FeedList";

const CATEGORIES = [
  { value: "tutorial", label: "Tutorials" },
  { value: "pattern", label: "Patterns" },
  { value: "question", label: "Questions" },
  { value: "showcase", label: "Showcases" },
  { value: "meta", label: "Meta" },
] as const;

const SURFACES = [
  { value: "all", label: "All threads" },
  { value: "stave-attached", label: "Stave threads" },
  { value: "standalone", label: "Standalone" },
  { value: "following", label: "Following" },
] as const;

const SORTS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
] as const;

const TIMES = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
] as const;

type FeaturedStave = { slug: string; title: string; viewsCount: number };

type Query = {
  sort: string;
  time: string;
  surface: string;
  category: string | null;
  tag: string | null;
  showEmpty: boolean;
  offset: number;
};

function buildHref(query: Query, overrides: Partial<Query>): string {
  const q = { ...query, ...overrides, offset: 0 };
  const params = new URLSearchParams();
  if (q.sort !== "hot") params.set("sort", q.sort);
  if (q.time !== "week") params.set("time", q.time);
  if (q.surface !== "all") params.set("surface", q.surface);
  if (q.category) params.set("category", q.category);
  if (q.tag) params.set("tag", q.tag);
  if (q.showEmpty) params.set("show", "empty");
  const qs = params.toString();
  return qs ? `/tavern?${qs}` : "/tavern";
}

function SideNav({
  query,
  viewerId,
}: {
  query: Query;
  viewerId: string | null;
}) {
  return (
    <aside className="tavern-sidenav">
      {/* Sort */}
      <section className="tavern-sidenav-section">
        <div className="tavern-sidenav-title">Sort</div>
        <ul className="tavern-sidenav-list">
          {SORTS.map((s) => (
            <li key={s.value}>
              <a
                href={buildHref(query, { sort: s.value })}
                className={
                  "tavern-sidenav-link" +
                  (query.sort === s.value ? " is-active" : "")
                }
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Time (only relevant for hot/top) */}
      {query.sort !== "new" && (
        <section className="tavern-sidenav-section">
          <div className="tavern-sidenav-title">Time</div>
          <ul className="tavern-sidenav-list">
            {TIMES.map((t) => (
              <li key={t.value}>
                <a
                  href={buildHref(query, { time: t.value })}
                  className={
                    "tavern-sidenav-link" +
                    (query.time === t.value ? " is-active" : "")
                  }
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Surface */}
      <section className="tavern-sidenav-section">
        <div className="tavern-sidenav-title">Surface</div>
        <ul className="tavern-sidenav-list">
          {SURFACES.map((s) => {
            const disabled = s.value === "following" && !viewerId;
            return (
              <li key={s.value}>
                <a
                  href={
                    disabled ? "/sign-in" : buildHref(query, { surface: s.value })
                  }
                  className={
                    "tavern-sidenav-link" +
                    (query.surface === s.value ? " is-active" : "") +
                    (disabled ? " is-muted" : "")
                  }
                >
                  {s.label}
                  {disabled && (
                    <span className="tavern-sidenav-cta"> (sign in)</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Categories */}
      <section className="tavern-sidenav-section">
        <div className="tavern-sidenav-title">Category</div>
        <ul className="tavern-sidenav-list">
          <li>
            <a
              href={buildHref(query, { category: null })}
              className={
                "tavern-sidenav-link" + (!query.category ? " is-active" : "")
              }
            >
              All
            </a>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c.value}>
              <a
                href={buildHref(query, { category: c.value })}
                className={
                  "tavern-sidenav-link" +
                  (query.category === c.value ? " is-active" : "")
                }
              >
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function RightRail({ featuredStaves }: { featuredStaves: FeaturedStave[] }) {
  return (
    <aside className="tavern-rail">
      {/* Featured staves */}
      <div className="side-card">
        <div className="side-card-title">Featured Staves</div>
        {featuredStaves.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
            No staves yet.
          </p>
        ) : (
          <ul className="side-card-list">
            {featuredStaves.map((s) => (
              <li key={s.slug}>
                <Link href={`/staves/${s.slug}`} className="tavern-rail-stave-link">
                  {s.title}
                </Link>
                <small>{s.viewsCount.toLocaleString()} views</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Active scribes (v1 placeholder) */}
      <div className="side-card">
        <div className="side-card-title">Active Scribes</div>
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Coming soon</p>
      </div>

      {/* Tavern rules */}
      <div className="side-card">
        <div className="side-card-title">Tavern Rules</div>
        <ol className="tavern-rules-list">
          <li>Be respectful and constructive.</li>
          <li>Stay on topic — keep threads relevant to agents and staves.</li>
          <li>No spam or self-promotion without context.</li>
          <li>Search before posting to avoid duplicates.</li>
          <li>Flag rule-breakers; don&apos;t engage them.</li>
        </ol>
      </div>
    </aside>
  );
}

export type TavernIndexLayoutProps = {
  threads: ThreadFeedRow[];
  hasMore: boolean;
  pinned: ThreadFeedRow | null;
  featuredStaves: FeaturedStave[];
  query: Query;
  viewerId: string | null;
};

export function TavernIndexLayout({
  threads,
  hasMore,
  pinned,
  featuredStaves,
  query,
  viewerId,
}: TavernIndexLayoutProps) {
  const isFollowingAnon = query.surface === "following" && !viewerId;

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 48 }}>
      <div className="tavern-layout">
        <SideNav query={query} viewerId={viewerId} />

        <main className="tavern-feed">
          {/* Feed toolbar — sort/surface quick links */}
          <div className="tavern-feed-toolbar">
            <div className="tavern-feed-sorts">
              {SORTS.map((s) => (
                <a
                  key={s.value}
                  href={buildHref(query, { sort: s.value })}
                  className={
                    "tavern-feed-sort-link" +
                    (query.sort === s.value ? " is-active" : "")
                  }
                >
                  {s.label}
                </a>
              ))}
            </div>
            {query.tag && (
              <span className="tavern-tag-filter-badge">
                #{query.tag}{" "}
                <a href={buildHref(query, { tag: null })} className="tavern-tag-clear">
                  ×
                </a>
              </span>
            )}
          </div>

          {/* Following-anon CTA */}
          {isFollowingAnon ? (
            <div className="empty-state" style={{ marginTop: 24 }}>
              <h2>Sign in to see your following feed</h2>
              <p>
                When you follow stave authors or staves, their Tavern threads
                appear here.
              </p>
              <div className="empty-state-actions">
                <Link href="/sign-in" className="btn btn-primary">
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <FeedList
              initial={threads}
              hasMore={hasMore}
              pinned={pinned}
              query={query}
            />
          )}
        </main>

        <RightRail featuredStaves={featuredStaves} />
      </div>
    </div>
  );
}
