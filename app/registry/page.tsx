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

  const popularStaves = useMemo(
    () =>
      [...filteredStaves]
        .sort((a, b) => {
          if (b.popularityScore !== a.popularityScore) {
            return b.popularityScore - a.popularityScore;
          }
          if (b.viewsCount !== a.viewsCount) {
            return b.viewsCount - a.viewsCount;
          }
          return b.upvotes - a.upvotes;
        })
        .slice(0, 6),
    [filteredStaves],
  );

  const mostUpvotedRecentStaves = useMemo(
    () =>
      [...filteredStaves]
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
        .slice(0, 6)
        .sort((a, b) => {
          const aVoteDelta = a.upvotes - a.downvotes;
          const bVoteDelta = b.upvotes - b.downvotes;

          if (bVoteDelta !== aVoteDelta) {
            return bVoteDelta - aVoteDelta;
          }

          return b.upvotes - a.upvotes;
        }),
    [filteredStaves],
  );

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
      const existing = map.get(stave.scribe) ?? { name: stave.scribe, staves: 0, score: 0 };
      existing.staves += 1;
      existing.score += stave.popularityScore + Math.floor(stave.upvotes / 20);
      map.set(stave.scribe, existing);
    });

    return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [filteredStaves]);

  const trendingTags = useMemo(() => {
    const map = new Map<string, number>();
    filteredStaves.forEach((stave) => {
      stave.tags.forEach((tag) => {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      });
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [filteredStaves]);

  return (
    <section className="container page-block panel-stack">
      <div className="registry-gallery-head">
        <div>
          <p className="registry-headstone-kicker">Galdr Community Gallery</p>
          <h1 className="section-title">Registry</h1>
          <p className="registry-gallery-note muted">
            Discover popular staves, track active scribes, and browse the latest upvoted
            work from the ritual feed.
          </p>
        </div>
        <span className="muted">{filteredStaves.length} staves in feed</span>
      </div>

      <div className="registry-toolbar-row">
        <div className="registry-search-wrap">
          <Search size={16} className="registry-search-icon" />
          <input
            className="input with-icon"
            placeholder="Search staves, scribes, tags..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search staves"
          />
        </div>

        <select
          className="select"
          value={selectedTag}
          onChange={(event) => setSelectedTag(event.target.value)}
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

      <div id="registry-feed" className="registry-layout">
        <section className="registry-main-feed" aria-labelledby="registry-feed-title">
          <div className="section-head section-head-tight">
            <h2 id="registry-feed-title" className="section-title section-title-feed">
              Featured Feed
            </h2>
            <span className="muted">Ranked by popularity, votes, and discussion</span>
          </div>

          <div className="registry-feed-grid">
            {registryFeed.map((stave) => (
              <StaveCard key={`feed-${stave.id}`} stave={stave} />
            ))}
          </div>
        </section>

        <aside className="registry-side-rail" aria-label="Registry side rail">
          <section className="registry-rail-card">
            <h3>Trending tags</h3>
            <div className="registry-rail-tags">
              {trendingTags.map(([tag, count]) => (
                <span key={tag} className="tag">
                  #{tag} ({count})
                </span>
              ))}
            </div>
          </section>

          <section className="registry-rail-card">
            <h3>Top scribes</h3>
            <ul className="registry-rail-list">
              {topScribes.map((scribe) => (
                <li key={scribe.name}>
                  <span>{scribe.name}</span>
                  <small>{scribe.staves} staves</small>
                </li>
              ))}
            </ul>
          </section>

          <section className="registry-rail-card">
            <h3>Today&apos;s spotlight</h3>
            <ul className="registry-rail-list">
              {popularStaves.slice(0, 2).map((stave) => (
                <li key={`popular-spotlight-${stave.id}`}>
                  <span>{stave.title}</span>
                  <small>{stave.popularityScore} popularity</small>
                </li>
              ))}
              {mostUpvotedRecentStaves.slice(0, 2).map((stave) => (
                <li key={`recent-spotlight-${stave.id}`}>
                  <span>{stave.title}</span>
                  <small>{stave.upvotes - stave.downvotes} vote delta</small>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {filteredStaves.length === 0 ? (
        <p className="muted">
          No staves found in the gallery. Try a different search rune.
        </p>
      ) : null}
    </section>
  );
}
