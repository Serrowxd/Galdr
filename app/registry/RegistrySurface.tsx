"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowUp,
  Bookmark,
  Download,
  LayoutGrid,
  List,
  Search,
  TrendingUp,
} from "lucide-react";

import { GrimoireCard } from "@/components/GrimoireCard";
import { StaveCard } from "@/components/StaveCard";

export type RegistryFeedItem = {
  kind: "stave" | "grimoire";
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  version: number;
  staveCount: number;
  authorUsername: string | null;
  savesCount: number;
  downloadsCount: number;
  upvotes: number;
  downvotes: number;
  isOrchestration: boolean;
  saved: boolean;
};

type TagCount = { tag: string; count: number };
type Scribe = { userId: string; username: string; staveCount: number };

type RegistrySurfaceProps = {
  items: RegistryFeedItem[];
  tags: TagCount[];
  topScribes: Scribe[];
  counts: { all: number; stave: number; grimoire: number };
  total: number;
  page: number;
  totalPages: number;
  startRank: number;
  prevHref: string | null;
  nextHref: string | null;
  staveFilter?: { slug: string; title: string } | null;
};

function SaveButton({ item }: { item: RegistryFeedItem }) {
  const router = useRouter();
  const [saved, setSaved] = useState(item.saved);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const path =
      item.kind === "stave"
        ? `/api/staves/${item.id}/save`
        : `/api/grimoires/${item.id}/save`;
    // Staves use POST to save / DELETE to unsave; grimoires toggle on POST.
    const method = item.kind === "stave" && saved ? "DELETE" : "POST";
    try {
      const res = await fetch(path, { method });
      if (res.status === 401) {
        router.push("/sign-in");
        return;
      }
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { saved?: boolean };
        setSaved(data.saved ?? !saved);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`reg-b-row-save ${saved ? "saved" : ""}`}
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from library" : "Save to library"}
      title={saved ? "Saved" : "Save to library"}
    >
      <Bookmark size={14} aria-hidden />
    </button>
  );
}

function RegistryRow({ item, rank }: { item: RegistryFeedItem; rank: number }) {
  const router = useRouter();
  const href =
    item.kind === "stave" ? `/staves/${item.slug}` : `/grimoires/${item.slug}`;
  const score = item.upvotes - item.downvotes;

  return (
    <div
      className={`reg-b-row ${item.kind === "grimoire" ? "grimoire" : ""}`}
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
    >
      <div className="reg-b-row-rank">{rank}</div>
      <div className="reg-b-row-main">
        <div className="reg-b-row-title-line">
          <span className="reg-b-row-title">{item.title}</span>
          <span className="reg-b-row-title-tags">
            {item.isOrchestration ? (
              <span className="tag orchestration">orchestration</span>
            ) : null}
            {item.kind === "stave" ? (
              <>
                <span className="tag stave-type">Stave</span>
                <span className="tag hi">v{item.version}</span>
              </>
            ) : (
              <>
                <span className="tag grimoire-type">Grimoire</span>
                <span className="tag">{item.staveCount} staves</span>
              </>
            )}
          </span>
        </div>
        {item.authorUsername ? (
          <div className="reg-b-row-author">
            by <span>{item.authorUsername}</span>
          </div>
        ) : null}
        {item.description ? (
          <div className="reg-b-row-desc">{item.description}</div>
        ) : null}
      </div>
      <div className="reg-b-row-right">
        <div className="reg-b-stats">
          <span className="stat">
            <Bookmark size={11} aria-hidden /> {item.savesCount.toLocaleString()}
          </span>
          <span className="stat">
            <Download size={11} aria-hidden /> {item.downloadsCount.toLocaleString()}
          </span>
          <span className="stat">
            <ArrowUp size={11} aria-hidden /> {score.toLocaleString()}
          </span>
        </div>
        <SaveButton item={item} />
      </div>
    </div>
  );
}

export function RegistrySurface({
  items,
  tags,
  topScribes,
  counts,
  total,
  page,
  totalPages,
  startRank,
  prevHref,
  nextHref,
  staveFilter,
}: RegistrySurfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const sort = searchParams.get("sort") === "new" ? "new" : "top";
  // A stave filter is inherently a grimoires-only view (a stave can't contain a
  // stave), so reflect that in the type toggle even though `?type` isn't set.
  const type = staveFilter ? "grimoire" : searchParams.get("type") ?? "all";
  const activeTag = searchParams.get("tag") ?? "all";

  const update = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    router.replace(`/registry?${params.toString()}`);
  };

  const typeLabel =
    type === "stave" ? "staves" : type === "grimoire" ? "grimoires" : "packages";

  return (
    <div className="reg-b">
      <div className="reg-b-header">
        <div className="reg-b-sort" role="group" aria-label="Sort">
          <button
            type="button"
            className={`reg-b-sort-item ${sort === "top" ? "active" : ""}`}
            aria-pressed={sort === "top"}
            onClick={() => update({ sort: "top" })}
          >
            <TrendingUp size={13} aria-hidden /> Top
          </button>
          <button
            type="button"
            className={`reg-b-sort-item ${sort === "new" ? "active" : ""}`}
            aria-pressed={sort === "new"}
            onClick={() => update({ sort: "new" })}
          >
            New
          </button>
        </div>

        <form
          className="reg-b-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: query.trim() });
          }}
        >
          <Search size={14} aria-hidden />
          <input
            type="search"
            placeholder="Search staves, descriptions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the registry"
          />
        </form>

        <div className="reg-b-header-right">
          <div className="reg-b-type-btns" role="group" aria-label="Type">
            {(
              [
                ["all", "All", counts.all],
                ["stave", "Staves", counts.stave],
                ["grimoire", "Grimoires", counts.grimoire],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                className={`reg-b-type-btn ${type === value ? "active" : ""}`}
                aria-pressed={type === value}
                onClick={() => update({ type: value })}
              >
                {label} <span className="reg-b-type-count">{count}</span>
              </button>
            ))}
          </div>
          <div className="view-toggle" role="group" aria-label="View">
            <button
              type="button"
              className={`view-btn ${view === "grid" ? "active" : ""}`}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={15} aria-hidden />
            </button>
            <button
              type="button"
              className={`view-btn ${view === "list" ? "active" : ""}`}
              aria-pressed={view === "list"}
              aria-label="List view"
              onClick={() => setView("list")}
            >
              <List size={15} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="reg-b-body">
        <aside className="reg-b-sidebar" aria-label="Filters">
          <div className="reg-b-sidebar-label">Filter by tag</div>
          <button
            type="button"
            className={`reg-b-sidebar-tag ${activeTag === "all" ? "active" : ""}`}
            aria-pressed={activeTag === "all"}
            onClick={() => update({ tag: null })}
          >
            all
            <span className="reg-b-sidebar-tag-count">{counts.all}</span>
          </button>
          {tags.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              className={`reg-b-sidebar-tag ${activeTag === tag ? "active" : ""}`}
              aria-pressed={activeTag === tag}
              onClick={() => update({ tag })}
            >
              {tag}
              <span className="reg-b-sidebar-tag-count">{count}</span>
            </button>
          ))}

          {topScribes.length > 0 ? (
            <>
              <div className="reg-b-sidebar-divider" />
              <div className="reg-b-sidebar-label">Top scribes</div>
              <ul className="reg-b-sidebar-scribes">
                {topScribes.map((scribe) => (
                  <li key={scribe.userId}>
                    <Link href={`/saga/${scribe.username.toLowerCase()}`}>
                      <span>{scribe.username}</span>
                      <small>{scribe.staveCount} staves</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>

        <div className="reg-b-feed">
          {staveFilter ? (
            <div className="reg-b-stave-filter">
              <span>
                Grimoires containing <strong>{staveFilter.title}</strong>
              </span>
              <button
                type="button"
                className="chip"
                onClick={() => update({ stave: null, type: null })}
              >
                Clear ×
              </button>
            </div>
          ) : null}

          <div className="reg-b-feed-header">
            Showing <strong>{total.toLocaleString()}</strong> {typeLabel} — sorted
            by {sort === "new" ? "newest" : "monthly score"}
          </div>

          {items.length === 0 ? (
            <div className="reg-b-empty">
              <p className="muted">No entries match this view.</p>
              <p className="muted">
                <Link href="/registry">Clear filters</Link>
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="reg-b-grid">
              {items.map((item) =>
                item.kind === "stave" ? (
                  <StaveCard
                    key={`s-${item.id}`}
                    stave={{
                      slug: item.slug,
                      title: item.title,
                      description: item.description,
                      tags: item.tags,
                      version: item.version,
                      authorUsername: item.authorUsername,
                      savesCount: item.savesCount,
                      downloadsCount: item.downloadsCount,
                      upvotes: item.upvotes,
                      downvotes: item.downvotes,
                    }}
                  />
                ) : (
                  <GrimoireCard
                    key={`g-${item.id}`}
                    grimoire={{
                      slug: item.slug,
                      title: item.title,
                      shortDescription: item.description,
                      tags: item.tags,
                      version: item.version,
                      staveCount: item.staveCount,
                      authorUsername: item.authorUsername,
                      savesCount: item.savesCount,
                      upvotes: item.upvotes,
                      downvotes: item.downvotes,
                      downloadsCount: item.downloadsCount,
                    }}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="reg-b-rows">
              {items.map((item, i) => (
                <RegistryRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  rank={startRank + i}
                />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="reg-b-pagination" aria-label="Pagination">
              {prevHref ? (
                <Link href={prevHref} className="chip">
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
              {nextHref ? (
                <Link href={nextHref} className="chip">
                  Next →
                </Link>
              ) : (
                <span className="chip" aria-disabled>
                  Next →
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
