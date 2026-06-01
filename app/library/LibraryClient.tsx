"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowUp,
  Book,
  BookMarked,
  Download,
  LayoutGrid,
  List,
  Plus,
  ScrollText,
  Search,
} from "lucide-react";

import { GrimoireCard } from "@/components/GrimoireCard";
import { StaveCard } from "@/components/StaveCard";
import type { LibraryGrimoireRow, LibraryStaveRow } from "@/lib/library";

const ORCHESTRATION_TAG = "orchestration";

function relativeTime(date: Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

type Scope = "all" | "staves";
type Sort = "recent" | "title" | "top";
type Layout = "grid" | "list";

export function LibraryClient({
  staves,
  grimoires,
}: {
  staves: LibraryStaveRow[];
  grimoires: LibraryGrimoireRow[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");
  const [layout, setLayout] = useState<Layout>("list");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [pending, setPending] = useState<string | null>(null);

  const ownedGrimoires = useMemo(
    () => grimoires.filter((g) => g.owned),
    [grimoires],
  );
  const savedGrimoires = useMemo(
    () => grimoires.filter((g) => !g.owned),
    [grimoires],
  );

  const q = query.trim().toLowerCase();
  const matches = (title: string) => !q || title.toLowerCase().includes(q);
  const ts = (d: Date) => new Date(d).getTime();

  const sortedStaves = useMemo(() => {
    const rows = staves.filter((r) => matches(r.title));
    return rows.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "top") return b.savesCount - a.savesCount;
      return ts(b.updatedAt) - ts(a.updatedAt);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staves, q, sort]);

  const sortedGrimoires = useMemo(() => {
    const rows = grimoires.filter((r) => matches(r.title));
    return rows.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "top") return b.savesCount - a.savesCount;
      return ts(b.updatedAt) - ts(a.updatedAt);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grimoires, q, sort]);

  const removeStave = async (row: LibraryStaveRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = row.owned
      ? `Delete "${row.title}" permanently? This cannot be undone.`
      : `Remove "${row.title}" from your library?`;
    // TODO(spec 16): replace confirm() with a styled confirmation dialog.
    if (!window.confirm(msg)) return;
    setPending(row.id);
    const path = row.owned
      ? `/api/staves/${row.id}`
      : `/api/staves/${row.id}/save`;
    try {
      const res = await fetch(path, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  };

  const removeGrimoire = async (row: LibraryGrimoireRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = row.owned
      ? `Delete "${row.title}" permanently? This cannot be undone.`
      : `Remove "${row.title}" from your library?`;
    if (!window.confirm(msg)) return;
    setPending(row.id);
    // Owned → soft-delete; saved-not-owned → toggle the bookmark off (POST toggles).
    const path = row.owned
      ? `/api/grimoires/${row.id}`
      : `/api/grimoires/${row.id}/save`;
    const method = row.owned ? "DELETE" : "POST";
    try {
      const res = await fetch(path, { method });
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  };

  const allSavedCount = staves.length + grimoires.length;
  const headerTitle = scope === "all" ? "All Saved" : "Staves";
  const headerCount = scope === "all" ? allSavedCount : staves.length;

  const hasStaves = sortedStaves.length > 0;
  const hasGrimoires = sortedGrimoires.length > 0;
  const empty = scope === "all" ? !hasStaves && !hasGrimoires : !hasStaves;

  return (
    <div className="lib-b">
      <nav className="lib-b-rail" aria-label="Library groups">
        <div className="lib-b-rail-header">
          <span className="lib-b-rail-title">Library</span>
        </div>

        <div className="lib-b-rail-group">
          <div className="lib-b-rail-group-label">Overview</div>
          <button
            type="button"
            className={`lib-b-rail-item ${scope === "all" ? "active" : ""}`}
            aria-current={scope === "all"}
            onClick={() => setScope("all")}
          >
            <BookMarked size={14} aria-hidden />
            <span className="lib-b-rail-label">All saved</span>
            <span className="lib-b-rail-count">{allSavedCount}</span>
          </button>
          <button
            type="button"
            className={`lib-b-rail-item ${scope === "staves" ? "active" : ""}`}
            aria-current={scope === "staves"}
            onClick={() => setScope("staves")}
          >
            <ScrollText size={14} aria-hidden />
            <span className="lib-b-rail-label">Staves</span>
            <span className="lib-b-rail-count">{staves.length}</span>
          </button>
        </div>

        {ownedGrimoires.length > 0 ? (
          <>
            <div className="lib-b-rail-divider" />
            <div className="lib-b-rail-group">
              <div className="lib-b-rail-group-label">My Grimoires</div>
              {ownedGrimoires.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="lib-b-rail-item is-grimoire"
                  onClick={() => router.push(`/grimoires/${g.slug}`)}
                >
                  <Book size={13} aria-hidden />
                  <span className="lib-b-rail-label">{g.title}</span>
                  <span className="lib-b-rail-count">{g.staveCount}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {savedGrimoires.length > 0 ? (
          <>
            <div className="lib-b-rail-divider" />
            <div className="lib-b-rail-group">
              <div className="lib-b-rail-group-label">Saved Grimoires</div>
              {savedGrimoires.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="lib-b-rail-item is-grimoire is-saved"
                  onClick={() => router.push(`/grimoires/${g.slug}`)}
                >
                  <Book size={13} aria-hidden />
                  <span className="lib-b-rail-label">{g.title}</span>
                  <span className="lib-b-rail-count">{g.staveCount}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <button
          type="button"
          className="lib-b-rail-new"
          onClick={() => router.push("/grimoires/new")}
        >
          <Plus size={13} aria-hidden /> New Grimoire
        </button>
      </nav>

      <div className="lib-b-main">
        <div className="lib-b-main-header">
          <h2 className="lib-b-main-title">{headerTitle}</h2>
          <span className="lib-b-main-count">{headerCount}</span>
          <div className="view-toggle" role="group" aria-label="View">
            <button
              type="button"
              className={`view-btn ${layout === "grid" ? "active" : ""}`}
              aria-pressed={layout === "grid"}
              aria-label="Grid view"
              onClick={() => setLayout("grid")}
            >
              <LayoutGrid size={15} aria-hidden />
            </button>
            <button
              type="button"
              className={`view-btn ${layout === "list" ? "active" : ""}`}
              aria-pressed={layout === "list"}
              aria-label="List view"
              onClick={() => setLayout("list")}
            >
              <List size={15} aria-hidden />
            </button>
          </div>
        </div>

        <div className="lib-b-controls">
          <label className="lib-b-filter">
            <Search size={13} aria-hidden />
            <input
              type="text"
              value={query}
              placeholder="Filter…"
              aria-label="Filter library"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="lib-b-sort" role="group" aria-label="Sort">
            {(
              [
                ["recent", "Recent"],
                ["title", "Title"],
                ["top", "Top"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`lib-b-sort-pill ${sort === value ? "active" : ""}`}
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {empty ? (
          <p className="lib-b-empty">
            {query
              ? "Nothing matches that filter."
              : scope === "staves"
                ? "No staves yet. Draft one in the Loom, import a .zip, or save staves from the registry."
                : "Your library is empty. Draft or save staves and grimoires from the registry."}
          </p>
        ) : (
          <>
            {hasStaves ? (
              <>
                <div className="lib-b-section-label">Staves</div>
                {layout === "grid" ? (
                  <div className="lib-b-grid">
                    {sortedStaves.map((row) => (
                      <StaveCard
                        key={row.id}
                        stave={{
                          slug: row.slug,
                          title: row.title,
                          description: null,
                          tags: row.tags,
                          version: row.version,
                          authorUsername: row.authorUsername,
                          savesCount: row.savesCount,
                          downloadsCount: row.downloadsCount,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="lib-b-rows">
                    {sortedStaves.map((row) => (
                      <StaveRow
                        key={row.id}
                        row={row}
                        pending={pending === row.id}
                        onRemove={removeStave}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {scope === "all" && hasGrimoires ? (
              <>
                <div className="lib-b-section-label">Grimoires</div>
                {layout === "grid" ? (
                  <div className="lib-b-grid">
                    {sortedGrimoires.map((row) => (
                      <GrimoireCard
                        key={row.id}
                        grimoire={{
                          slug: row.slug,
                          title: row.title,
                          shortDescription: null,
                          tags: row.tags,
                          version: row.version,
                          staveCount: row.staveCount,
                          authorUsername: row.authorUsername,
                          savesCount: row.savesCount,
                          downloadsCount: row.downloadsCount,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="lib-b-rows">
                    {sortedGrimoires.map((row) => (
                      <GrimoireRow
                        key={row.id}
                        row={row}
                        pending={pending === row.id}
                        onRemove={removeGrimoire}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function StaveRow({
  row,
  pending,
  onRemove,
}: {
  row: LibraryStaveRow;
  pending: boolean;
  onRemove: (row: LibraryStaveRow, e: React.MouseEvent) => void;
}) {
  const router = useRouter();
  const href = `/staves/${row.slug}`;
  const keywordTags = row.tags.slice(0, 3);

  return (
    <div className="lib-b-row">
      <div
        className="lib-b-row-link"
        role="link"
        tabIndex={0}
        onClick={() => router.push(href)}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(href);
        }}
      >
        <div className="lib-b-row-title-line">
          <span className="lib-b-row-title">{row.title}</span>
          <span className="lib-b-row-title-tags">
            <span className="tag stave-type">Stave</span>
            <span className="tag hi">v{row.version}</span>
            {row.status === "draft" ? <span className="tag">draft</span> : null}
          </span>
        </div>
        <div className="lib-b-row-meta">
          {row.authorUsername ? (
            <span className="author">by {row.authorUsername}</span>
          ) : null}
          <span className="stat">
            <ArrowUp size={11} aria-hidden /> {row.savesCount.toLocaleString()} saves
          </span>
          <span className="stat">
            <Download size={11} aria-hidden /> {row.downloadsCount.toLocaleString()}
          </span>
          {keywordTags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="lib-b-row-right">
        <span className="lib-b-row-date">updated {relativeTime(row.updatedAt)}</span>
        <button
          type="button"
          className="lib-b-remove"
          disabled={pending}
          aria-label={row.owned ? "Delete stave" : "Remove from library"}
          title={row.owned ? "Delete" : "Remove from library"}
          onClick={(e) => onRemove(row, e)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function GrimoireRow({
  row,
  pending,
  onRemove,
}: {
  row: LibraryGrimoireRow;
  pending: boolean;
  onRemove: (row: LibraryGrimoireRow, e: React.MouseEvent) => void;
}) {
  const router = useRouter();
  const href = `/grimoires/${row.slug}`;
  const isOrchestration = row.tags.includes(ORCHESTRATION_TAG);
  const keywordTags = row.tags.filter((t) => t !== ORCHESTRATION_TAG).slice(0, 3);
  const stamp =
    !row.owned && row.savedAt
      ? `saved ${relativeTime(row.savedAt)}`
      : `updated ${relativeTime(row.updatedAt)}`;

  return (
    <div className="lib-b-row">
      <div
        className="lib-b-row-link"
        role="link"
        tabIndex={0}
        onClick={() => router.push(href)}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(href);
        }}
      >
        <div className="lib-b-row-title-line">
          <span className="lib-b-row-title">{row.title}</span>
          <span className="lib-b-row-title-tags">
            {isOrchestration ? (
              <span className="tag orchestration">orchestration</span>
            ) : null}
            <span className="tag grimoire-type">Grimoire</span>
            <span className="tag">
              {row.staveCount} {row.staveCount === 1 ? "stave" : "staves"}
            </span>
            {row.status === "draft" ? <span className="tag">draft</span> : null}
          </span>
        </div>
        <div className="lib-b-row-meta">
          {row.authorUsername ? (
            <span className="author">by {row.authorUsername}</span>
          ) : null}
          <span className="stat">
            <ArrowUp size={11} aria-hidden /> {row.savesCount.toLocaleString()} saves
          </span>
          <span className="stat">
            <Download size={11} aria-hidden /> {row.downloadsCount.toLocaleString()}
          </span>
          {keywordTags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="lib-b-row-right">
        <span className="lib-b-row-date">{stamp}</span>
        <button
          type="button"
          className="lib-b-remove"
          disabled={pending}
          aria-label={row.owned ? "Delete grimoire" : "Remove from library"}
          title={row.owned ? "Delete" : "Remove from library"}
          onClick={(e) => onRemove(row, e)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
