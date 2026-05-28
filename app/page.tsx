import Link from "next/link";
import { Search } from "lucide-react";

import { StaveCard } from "@/components/StaveCard";
import { VegvisirLogo } from "@/components/VegvisirLogo";
import { getDbOptional } from "@/db";
import { getTopScribes, getTrendingTags, listStaves } from "@/lib/staves";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const db = getDbOptional();

  let featured: Awaited<ReturnType<typeof listStaves>>["rows"] = [];
  let total = 0;
  let scribeCount = 0;
  let tags: string[] = [];

  if (db) {
    const [feed, scribes, trending] = await Promise.all([
      listStaves(db, { status: "published", sort: "top", limit: 9 }),
      getTopScribes(db, 100),
      getTrendingTags(db, 8),
    ]);
    featured = feed.rows;
    total = feed.total;
    scribeCount = scribes.length;
    tags = trending.map((t) => t.tag);
  }

  return (
    <>
      <section className="page-hero" aria-labelledby="hero-title">
        <div className="container page-hero-inner">
          <div className="page-hero-copy">
            <p className="page-hero-tag">Open agent registry</p>
            <h1 id="hero-title" className="page-hero-title">
              Skills for your agents.
              <br />
              Built by the community.
            </h1>
            <p className="page-hero-sub">
              Download staves — markdown skill bundles for Claude, Codex, and any
              agent that reads instructions. Search, remix, publish.
            </p>
            <div className="page-hero-stats" aria-label="Registry stats">
              <span className="stat-tiny">
                <strong>{total.toLocaleString()}</strong>staves
              </span>
              <span className="stat-tiny">
                <strong>{scribeCount.toLocaleString()}</strong>scribes
              </span>
            </div>
          </div>
          <div className="page-hero-emblem" aria-hidden>
            <VegvisirLogo size={220} />
          </div>
        </div>
      </section>

      <div className="container">
        <div className="toolbar-row">
          <form className="search-bar" role="search" action="/registry" method="get">
            <Search size={16} aria-hidden />
            <input
              type="search"
              name="q"
              placeholder='Search staves — "code review", "knowledge base", "deploy"…'
              aria-label="Search staves"
            />
          </form>
        </div>

        {tags.length > 0 ? (
          <div className="filters" role="toolbar" aria-label="Browse by tag">
            <span className="filters-label">Trending</span>
            {tags.map((tag) => (
              <Link key={tag} href={`/registry?tag=${tag}`} className="chip">
                {tag}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="section-head" style={{ marginTop: 8 }}>
          <h2>Featured staves</h2>
          <Link href="/registry" className="muted">
            Browse all →
          </Link>
        </div>

        {featured.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p className="muted">Nothing published yet.</p>
            <p className="muted">
              <Link href="/loom">Open the Loom →</Link>
            </p>
          </div>
        ) : (
          <div className="stave-grid">
            {featured.map((stave) => (
              <StaveCard key={stave.id} stave={stave} />
            ))}
          </div>
        )}
      </div>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
          <span>Markdown skill bundles for any agent that reads instructions.</span>
        </div>
      </footer>
    </>
  );
}
