"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bookmark,
  BookMarked,
  Download,
  FileText,
  Folder,
  GitFork,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AddToGrimoireDialog } from "@/components/grimoires/AddToGrimoireDialog";
import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import { renderMarkdownPreview } from "@/lib/markdownPreview";
import { buildTree, type TreeNode } from "@/lib/packageTree";
import { defaultTabFor, type TabId } from "@/lib/staveTabs";
import type {
  ForkAttribution,
  Stave,
  StaveStats,
  StaveVersion,
} from "@/lib/staves";
import type { StavePackageFile } from "@/lib/stavePackages";

type GrimoireRef = { slug: string; title: string; staveCount: number };

type StaveDetailClientProps = {
  stave: Stave;
  authorName: string;
  authorAvatarUrl: string | null;
  sagaHref: string;
  scribeStats: { staveCount: number; saves: number };
  isAuthor: boolean;
  status: "draft" | "published";
  initialTab: TabId;
  versions: StaveVersion[];
  grimoires: GrimoireRef[];
  stats: StaveStats;
  packageFiles: StavePackageFile[];
  forkedFrom: ForkAttribution | null;
  initialSaved: boolean;
};

// --- small formatters -------------------------------------------------------

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function timeAgo(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// --- Files tab tree ---------------------------------------------------------

function FileTree({
  nodes,
  sizes,
  entrypoint,
  active,
  onOpen,
}: {
  nodes: TreeNode[];
  sizes: Map<string, number>;
  entrypoint: string;
  active: string;
  onOpen: (path: string) => void;
}) {
  return (
    <ul className="stave-tree-list">
      {nodes.map((node) => {
        if (node.kind === "dir") {
          return (
            <li key={`dir-${node.path}`}>
              <div className="stave-tree-row stave-tree-folder">
                <Folder size={13} aria-hidden />
                <span>{node.name}</span>
              </div>
              <FileTree
                nodes={node.nodes}
                sizes={sizes}
                entrypoint={entrypoint}
                active={active}
                onOpen={onOpen}
              />
            </li>
          );
        }
        const isEntry = node.path === entrypoint;
        return (
          <li key={node.path}>
            <button
              type="button"
              className={`stave-tree-row stave-tree-file ${node.path === active ? "is-active" : ""}`}
              onClick={() => onOpen(node.path)}
            >
              <FileText size={13} aria-hidden />
              <span>{node.name}</span>
              {isEntry ? (
                <span className="stave08-ep-badge">entrypoint</span>
              ) : null}
              <span className="stave08-file-size">
                {formatBytes(sizes.get(node.path) ?? 0)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function StaveDetailClient({
  stave,
  authorName,
  authorAvatarUrl,
  sagaHref,
  scribeStats,
  isAuthor,
  status,
  initialTab,
  versions,
  grimoires,
  stats,
  packageFiles,
  forkedFrom,
  initialSaved,
}: StaveDetailClientProps) {
  const router = useRouter();

  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);
  const isLoaded = user !== undefined;
  const isSignedIn = isLoaded && user !== null;

  const isPublished = status === "published";

  // Loom-authored staves carry their text in `stave.body` with no package files —
  // fall back to a synthetic stave.md so the tree + readme still render.
  const effectiveFiles = useMemo<StavePackageFile[]>(
    () =>
      packageFiles.length > 0
        ? packageFiles
        : stave.body
          ? [{ path: "stave.md", content: stave.body }]
          : [],
    [packageFiles, stave.body],
  );

  // Entrypoint resolution: explicit column → file mirroring body → README → first.
  const entrypointPath = useMemo(() => {
    if (
      stave.entrypointPath &&
      effectiveFiles.some((f) => f.path === stave.entrypointPath)
    ) {
      return stave.entrypointPath;
    }
    const byBody = effectiveFiles.find((f) => f.content === stave.body)?.path;
    if (byBody) return byBody;
    const byReadme = effectiveFiles.find((f) =>
      f.path.endsWith("README.md"),
    )?.path;
    return byReadme ?? effectiveFiles[0]?.path ?? "";
  }, [effectiveFiles, stave.entrypointPath, stave.body]);

  const pathToContent = useMemo(() => {
    const m = new Map<string, string>();
    effectiveFiles.forEach((f) => m.set(f.path, f.content));
    return m;
  }, [effectiveFiles]);

  const sizes = useMemo(() => {
    const m = new Map<string, number>();
    effectiveFiles.forEach((f) => m.set(f.path, byteLength(f.content)));
    return m;
  }, [effectiveFiles]);

  const tree = useMemo(() => buildTree(effectiveFiles), [effectiveFiles]);

  // The Readme tab exists only when a real README file was packaged — we render
  // that file verbatim (not the entrypoint). Synthetic stave.md doesn't count.
  const readmePath = useMemo(
    () =>
      packageFiles.find(
        (f) => f.path.split("/").pop()?.toLowerCase() === "readme.md",
      )?.path ?? null,
    [packageFiles],
  );
  const hasReadme = readmePath != null;
  const readmeBody = readmePath ? pathToContent.get(readmePath) ?? "" : "";

  // --- tabs: instant client swap, URL kept in sync for deep-links/refresh ----
  const defaultTab = defaultTabFor(hasReadme);
  const [tab, setTab] = useState<TabId>(initialTab);
  // A ?tab=readme deep-link on a stave with no README falls back to the default.
  const activeTab: TabId = tab === "readme" && !hasReadme ? defaultTab : tab;
  const selectTab = (next: TabId) => {
    setTab(next);
    if (typeof window !== "undefined") {
      const url =
        next === defaultTab
          ? `/staves/${stave.slug}`
          : `/staves/${stave.slug}?tab=${next}`;
      window.history.replaceState(null, "", url);
    }
  };

  const tabDefs: { id: TabId; label: string; badge: number | null }[] = [
    ...(hasReadme
      ? [{ id: "readme" as const, label: "Readme", badge: null }]
      : []),
    { id: "files", label: "Files", badge: effectiveFiles.length },
    { id: "discussion", label: "Discussion", badge: stats.openThreads },
    { id: "versions", label: "Versions", badge: versions.length },
  ];

  // --- engagement / action handlers -----------------------------------------
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [showPublish, setShowPublish] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [showAddToGrimoire, setShowAddToGrimoire] = useState(false);
  const [grimoireToast, setGrimoireToast] = useState<string | null>(null);
  const [showDownload, setShowDownload] = useState(false);
  const [downloadFolder, setDownloadFolder] = useState("");
  // Files tab: inline split inspector — selected file + raw/formatted toggle.
  const [selectedPath, setSelectedPath] = useState<string>(entrypointPath);
  const [fileView, setFileView] = useState<"preview" | "raw">("preview");
  const selectedContent = selectedPath
    ? pathToContent.get(selectedPath) ?? ""
    : "";

  const toggleSave = () => {
    if (!isSignedIn) return;
    startTransition(async () => {
      setError(null);
      const next = !saved;
      try {
        const res = await fetch(`/api/staves/${stave.id}/save`, {
          method: next ? "POST" : "DELETE",
        });
        if (!res.ok) throw new Error("Save failed");
        const data = (await res.json()) as { saved: boolean };
        setSaved(data.saved);
      } catch {
        setError("Could not update library.");
      }
    });
  };

  const fork = () => {
    if (!isSignedIn) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/staves/${stave.id}/fork`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Fork failed");
        const data = (await res.json()) as { id: string };
        router.push(`/loom?id=${data.id}`);
      } catch {
        setError("Could not fork stave.");
      }
    });
  };

  const triggerDownload = (folder?: string) => {
    const trimmed = folder?.trim();
    const query = trimmed ? `?folder=${encodeURIComponent(trimmed)}` : "";
    window.location.href = `/api/staves/${stave.id}/download${query}`;
    setShowDownload(false);
  };

  const startDownload = () => {
    if (effectiveFiles.length > 1) {
      setDownloadFolder("");
      setShowDownload(true);
    } else {
      triggerDownload();
    }
  };

  const confirmPublish = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/staves/${stave.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ releaseNotes: releaseNotes.trim() || undefined }),
        });
        if (!res.ok) throw new Error("Publish failed");
        const data = (await res.json()) as { slug: string };
        setShowPublish(false);
        router.push(`/staves/${data.slug}`);
      } catch {
        setError("Could not publish stave.");
      }
    });
  };

  const newVersion = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/staves/${stave.id}/new-version`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("New version failed");
        const data = (await res.json()) as { id: string };
        router.push(`/loom?id=${data.id}`);
      } catch {
        setError("Could not start a new version.");
      }
    });
  };

  const remove = () => {
    if (!confirm("Delete this stave? This cannot be undone from the UI.")) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/staves/${stave.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        router.push("/");
      } catch {
        setError("Could not delete stave.");
      }
    });
  };

  const visibleTags = stave.tags.slice(0, 5);
  const extraTags = stave.tags.length - visibleTags.length;

  return (
    <div className="stave08">
      {/* HEADER */}
      <header className="stave08-head">
        <div className="stave08-titleblock">
          <h1 className="stave08-title">{stave.title}</h1>
          <div className="stave08-slug">{stave.slug}</div>
          <p className="stave08-subline">
            {stave.description ?? "No description provided."}
          </p>
          <div className="stave08-meta">
            <span className="stave08-ver">v{stave.version}</span>
            {isAuthor ? (
              <span className="tag">{isPublished ? "Published" : "Draft"}</span>
            ) : null}
            {stave.private ? <span className="tag">Unlisted</span> : null}
            {visibleTags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
            {extraTags > 0 ? <span className="tag">+{extraTags} more</span> : null}
          </div>

          {forkedFrom ? (
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              <GitFork size={11} aria-hidden /> Forked from{" "}
              {forkedFrom.slug ? (
                <Link href={`/staves/${forkedFrom.slug}`}>{forkedFrom.title}</Link>
              ) : (
                <span>{forkedFrom.title}</span>
              )}
              {forkedFrom.authorUsername ? ` by ${forkedFrom.authorUsername}` : ""}
            </p>
          ) : null}
        </div>

        <div className="stave08-actions">
          <div className="stave08-actionrow">
            {isPublished && isSignedIn ? (
              <button
                type="button"
                className={`btn btn-ghost ${saved ? "btn-accent" : ""}`}
                onClick={toggleSave}
                disabled={pending}
              >
                <Bookmark size={14} /> {saved ? "Saved" : "Save"}
              </button>
            ) : null}
            {isPublished && isLoaded && !isSignedIn ? (
              <GaldrSignInButton>
                <span className="btn btn-ghost">
                  <Bookmark size={14} /> Save
                </span>
              </GaldrSignInButton>
            ) : null}

            {isPublished && isSignedIn && !isAuthor ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={fork}
                disabled={pending}
              >
                <GitFork size={14} /> {pending ? "Forking…" : "Fork"}
              </button>
            ) : null}
            {isPublished && isLoaded && !isSignedIn ? (
              <GaldrSignInButton>
                <span className="btn btn-ghost">
                  <GitFork size={14} /> Fork
                </span>
              </GaldrSignInButton>
            ) : null}

            {isPublished && isSignedIn ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowAddToGrimoire(true)}
                disabled={pending}
              >
                <BookMarked size={14} /> Add to…
              </button>
            ) : null}

            <button
              type="button"
              className="btn btn-primary"
              onClick={startDownload}
              disabled={pending}
            >
              <Download size={14} /> Download
            </button>
          </div>

        </div>
      </header>

      {/* TAB BAR */}
      <div className="stave08-tabs" role="tablist">
        {tabDefs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            className={`stave08-tab ${activeTab === t.id ? "is-active" : ""}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
            {t.badge != null && t.badge > 0 ? (
              <span className="stave08-tab-badge">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div className="stave08-grid">
        <div>
          {activeTab === "readme" ? (
            readmeBody.trim() ? (
              <article className="loom-preview stave-md-preview stave08-readme">
                {renderMarkdownPreview(readmeBody)}
              </article>
            ) : (
              <p className="stave08-empty">This README file is empty.</p>
            )
          ) : null}

          {activeTab === "files" ? (
            <section className="stave-inspector" aria-label="Package contents">
              {tree.length === 0 ? (
                <p className="muted" style={{ padding: 16 }}>
                  No package files for this stave.
                </p>
              ) : (
                <div className="stave-inspector-grid">
                  <aside className="stave-tree-panel" aria-label="File tree">
                    <FileTree
                      nodes={tree}
                      sizes={sizes}
                      entrypoint={entrypointPath}
                      active={selectedPath}
                      onOpen={setSelectedPath}
                    />
                  </aside>
                  <div className="stave-markdown-panel">
                    <div className="stave-md-tabs" role="tablist">
                      <span className="stave-inspector-path" style={{ marginRight: "auto" }}>
                        {selectedPath}
                        {selectedPath === entrypointPath ? (
                          <span className="stave08-ep-badge" style={{ marginLeft: 8 }}>
                            entrypoint
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        role="tab"
                        className={`stave-md-tab ${fileView === "preview" ? "is-active" : ""}`}
                        onClick={() => setFileView("preview")}
                      >
                        Formatted
                      </button>
                      <button
                        type="button"
                        role="tab"
                        className={`stave-md-tab ${fileView === "raw" ? "is-active" : ""}`}
                        onClick={() => setFileView("raw")}
                      >
                        Raw
                      </button>
                    </div>
                    {fileView === "raw" ? (
                      <textarea
                        className="stave-md-raw"
                        readOnly
                        value={selectedContent}
                        spellCheck={false}
                        aria-label="Raw file content"
                      />
                    ) : (
                      <article className="loom-preview stave-md-preview">
                        {renderMarkdownPreview(selectedContent)}
                      </article>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "discussion" ? (
            <p className="stave08-empty">
              No discussion yet — threads arrive with the Tavern. This tab will hold
              the auto-created discussion plus Q&amp;A and showcase threads.
            </p>
          ) : null}

          {activeTab === "versions" ? (
            versions.length === 0 ? (
              <p className="stave08-empty">No published versions yet.</p>
            ) : (
              <ul className="stave08-list">
                {versions.map((v) => (
                  <li key={v.slug}>
                    <div className="stave08-list-main">
                      <Link href={`/staves/${v.slug}`}>
                        v{v.version}
                        {v.version === stave.version ? " · this version" : ""}
                      </Link>
                      {v.releaseNotes ? (
                        <div className="stave08-list-sub">{v.releaseNotes}</div>
                      ) : null}
                    </div>
                    <span className="stave08-list-aside">
                      {v.publishedAt
                        ? new Date(v.publishedAt).toLocaleDateString()
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {error ? (
            <p className="stave-error" role="alert" style={{ marginTop: 16 }}>
              {error}
            </p>
          ) : null}
        </div>

        {/* RIGHT RAIL */}
        <aside className="stave08-rail">
          <section className="side-card">
            <h3 className="side-card-title">Maintainer</h3>
            <div className="stave08-maint">
              {authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="stave08-avatar"
                  src={authorAvatarUrl}
                  alt=""
                  aria-hidden
                />
              ) : (
                <span className="stave08-avatar" aria-hidden>
                  {authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <Link href={sagaHref} className="stave08-maint-name">
                  {authorName}
                </Link>
                <div className="stave08-maint-sub">
                  {scribeStats.staveCount}{" "}
                  {scribeStats.staveCount === 1 ? "stave" : "staves"} ·{" "}
                  {scribeStats.saves.toLocaleString()} saves
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              disabled
              title="Following is coming soon"
            >
              + Follow
            </button>
          </section>

          <section className="side-card">
            <h3 className="side-card-title">Stats</h3>
            <ul className="side-card-list">
              <li>
                <span>Downloads</span>
                <small>{stats.downloads.toLocaleString()}</small>
              </li>
              <li>
                <span>Saves</span>
                <small>{stats.saves.toLocaleString()}</small>
              </li>
              <li>
                <span>Open threads</span>
                <small>{stats.openThreads}</small>
              </li>
              <li>
                <span>Last published</span>
                <small>{timeAgo(stats.lastPublishedAt)}</small>
              </li>
            </ul>
          </section>

          <section className="side-card">
            <h3 className="side-card-title">Found in grimoires</h3>
            {grimoires.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>
                Not in any grimoires yet.
              </p>
            ) : (
              <>
                <ul className="side-card-list">
                  {grimoires.slice(0, 3).map((g) => (
                    <li key={g.slug} className="stave08-grim-row">
                      <Link href={`/grimoires/${g.slug}`}>{g.title}</Link>
                      <span className="tag">{g.staveCount}</span>
                    </li>
                  ))}
                </ul>
                {grimoires.length > 3 ? (
                  <Link
                    href={`/registry?stave=${encodeURIComponent(stave.slug)}`}
                    className="stave08-viewall"
                  >
                    View all {grimoires.length} →
                  </Link>
                ) : null}
              </>
            )}
          </section>

          <section className="side-card">
            <h3 className="side-card-title">Discussion settings</h3>
            <ul className="side-card-list">
              <li>
                <span>Auto-create</span>
                <small>on</small>
              </li>
              <li>
                <span>Author-only OP edit</span>
                <small>on</small>
              </li>
              <li>
                <span>Threading depth</span>
                <small>2</small>
              </li>
              <li>
                <span>Empty threads on /tavern</span>
                <small>hidden</small>
              </li>
            </ul>
          </section>

          {isAuthor ? (
            <section className="side-card">
              <h3 className="side-card-title">Owner</h3>
              {status === "draft" ? (
                <>
                  <Link
                    href={`/loom?id=${stave.id}`}
                    className="btn btn-soft btn-sm btn-block"
                  >
                    Edit in Loom
                  </Link>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-block"
                    onClick={() => setShowPublish(true)}
                    disabled={pending}
                  >
                    Publish
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-block"
                  onClick={newVersion}
                  disabled={pending}
                >
                  New version
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-block"
                onClick={remove}
                disabled={pending}
              >
                Delete
              </button>
            </section>
          ) : null}
        </aside>
      </div>

      {/* Grimoire toast */}
      {grimoireToast ? (
        <p className="muted" style={{ fontSize: 12.5 }} role="status">
          Added to <strong>{grimoireToast}</strong>.{" "}
          <button
            type="button"
            className="stave-action-link"
            onClick={() => setGrimoireToast(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {/* Download folder prompt (multi-file) */}
      {showDownload ? (
        <div className="stave08-dialog-backdrop" onClick={() => setShowDownload(false)}>
          <div
            className="stave08-dialog"
            role="dialog"
            aria-label="Download package"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440 }}
          >
            <div className="stave08-dialog-head">
              <span className="label-tiny">Download package</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowDownload(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="stave08-dialog-body" style={{ padding: 16, gap: 10 }}>
              <label className="label-tiny" htmlFor="download-folder">
                Parent folder name
              </label>
              <input
                id="download-folder"
                className="input"
                value={downloadFolder}
                maxLength={64}
                placeholder={authorName}
                onChange={(e) => setDownloadFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    triggerDownload(downloadFolder);
                  }
                }}
              />
              <p className="muted" style={{ fontSize: 12 }}>
                {effectiveFiles.length} files will be zipped under this folder. Left
                blank, we use <strong>{authorName}</strong>.
              </p>
              <div className="empty-state-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowDownload(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => triggerDownload(downloadFolder)}
                >
                  <Download size={13} /> Download .zip
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Publish dialog */}
      {showPublish ? (
        <div className="stave08-dialog-backdrop" onClick={() => setShowPublish(false)}>
          <div
            className="stave08-dialog"
            role="dialog"
            aria-label="Publish stave"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480 }}
          >
            <div className="stave08-dialog-head">
              <span className="label-tiny">Publish stave</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPublish(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="stave08-dialog-body" style={{ padding: 16, gap: 10 }}>
              <label className="label-tiny" htmlFor="release-notes">
                Release notes (optional, ≤ 500 chars)
              </label>
              <textarea
                id="release-notes"
                className="textarea"
                rows={3}
                maxLength={500}
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="What changed in this release?"
              />
              <p className="muted" style={{ fontSize: 12 }}>
                The public URL slug is locked once published.
              </p>
              <div className="empty-state-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowPublish(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={confirmPublish}
                  disabled={pending}
                >
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAddToGrimoire ? (
        <AddToGrimoireDialog
          staveFamilyId={stave.familyId}
          onClose={() => setShowAddToGrimoire(false)}
          onAdded={(title) => setGrimoireToast(title)}
        />
      ) : null}
    </div>
  );
}
