"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StaveCard } from "@/components/StaveCard";
import { staves } from "@/lib/mockData";

const allTags = Array.from(new Set(staves.flatMap((stave) => stave.tags))).sort();

export default function RegistryPage() {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");

  const filteredStaves = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return staves.filter((stave) => {
      const textMatch =
        lowered.length === 0 ||
        stave.title.toLowerCase().includes(lowered) ||
        stave.scribe.toLowerCase().includes(lowered) ||
        stave.tags.some((tag) => tag.toLowerCase().includes(lowered));
      const tagMatch = selectedTag === "all" || stave.tags.includes(selectedTag);
      return textMatch && tagMatch;
    });
  }, [query, selectedTag]);

  const registryFeed = useMemo(
    () =>
      [...filteredStaves].sort((a, b) => {
        const aScore = a.popularityScore * 10 + a.upvotes - a.downvotes + a.commentsCount;
        const bScore = b.popularityScore * 10 + b.upvotes - b.downvotes + b.commentsCount;
        if (bScore !== aScore) return bScore - aScore;
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      }),
    [filteredStaves],
  );

  const topScribes = useMemo(() => {
    const map = new Map<string, { name: string; staves: number; score: number }>();
    filteredStaves.forEach((stave) => {
      const existing = map.get(stave.scribe) ?? {
        name: stave.scribe,
        staves: 0,
        score: 0,
      };
      existing.staves += 1;
      existing.score += stave.popularityScore + Math.floor(stave.upvotes / 20);
      map.set(stave.scribe, existing);
    });
    return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 6);
  }, [filteredStaves]);

  const trendingTags = useMemo(() => {
    const map = new Map<string, number>();
    filteredStaves.forEach((stave) => {
      stave.tags.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filteredStaves]);

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
            running today.
          </p>
        </div>
      </section>

      <div className="container">
        <div className="toolbar-row">
          <div className="search-bar" role="search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder="Search staves, scribes, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search staves"
            />
          </div>

          <select
            className="select"
            style={{ maxWidth: 200 }}
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            aria-label="Filter by tag"
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        <div className="section-head">
          <h2>Featured feed</h2>
          <span className="muted">{filteredStaves.length} staves</span>
        </div>

        <div className="col-grid" style={{ paddingTop: 16 }}>
          <div>
            {registryFeed.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <p className="muted">No staves match this search.</p>
              </div>
            ) : (
              <div className="stave-grid">
                {registryFeed.map((stave) => (
                  <StaveCard key={`feed-${stave.id}`} stave={stave} />
                ))}
              </div>
            )}
          </div>

          <aside className="stack" style={{ gap: 16 }}>
            <section className="side-card">
              <h3 className="side-card-title">Trending tags</h3>
              <div className="side-card-tags">
                {trendingTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag} <span className="chip-count">{count}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="side-card">
              <h3 className="side-card-title">Top scribes</h3>
              <ul className="side-card-list">
                {topScribes.map((scribe) => (
                  <li key={scribe.name}>
                    <span>{scribe.name}</span>
                    <small>{scribe.staves} staves</small>
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
