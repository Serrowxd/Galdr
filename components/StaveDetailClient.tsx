"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bookmark,
  BookMarked,
  ChevronRight,
  Download,
  GitFork,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AddToGrimoireDialog } from "@/components/grimoires/AddToGrimoireDialog";
import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import { renderMarkdownPreview } from "@/lib/markdownPreview";
import { buildTree, type TreeNode } from "@/lib/packageTree";
import type { Stave, StaveVersion, ForkAttribution } from "@/lib/staves";
import type { StavePackageFile } from "@/lib/stavePackages";

export type StaveCommentDTO = {
  id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
};

function TreeList({
  nodes,
  depth,
  selectedPath,
  onSelect,
}: {
  nodes: TreeNode[];
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  return (
    <ul className="stave-tree-list">
      {nodes.map((node) => {
        if (node.kind === "dir") {
          return (
            <li key={`${depth}-${node.name}`}>
              <div className="stave-tree-row stave-tree-folder">
                <ChevronRight size={12} aria-hidden />
                <span>{node.name}</span>
              </div>
              <TreeList
                nodes={node.nodes}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            </li>
          );
        }
        const active = node.path === selectedPath;
        return (
          <li key={node.path}>
            <button
              type="button"
              className={`stave-tree-row stave-tree-file ${active ? "is-active" : ""}`}
              onClick={() => onSelect(node.path)}
            >
              {node.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type StaveDetailClientProps = {
  stave: Stave;
  authorName: string;
  sagaHref: string;
  isAuthor: boolean;
  status: "draft" | "published";
  versions: StaveVersion[];
  forkedFrom: ForkAttribution | null;
  packageFiles: StavePackageFile[];
  initialTotals: {
    upvotes: number;
    downvotes: number;
    commentsCount: number;
  };
  initialUserVote: 1 | -1 | 0;
  initialSaved: boolean;
  initialComments: StaveCommentDTO[];
};

export function StaveDetailClient({
  stave,
  authorName,
  sagaHref,
  isAuthor,
  status,
  versions,
  forkedFrom,
  packageFiles,
  initialTotals,
  initialUserVote,
  initialSaved,
  initialComments,
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
  const isSignedIn = user !== null && user !== undefined;

  // Loom-authored staves carry their text in `stave.body` and have no package
  // files. Fall back to a synthetic file so the inspector renders the body
  // instead of an empty "No package files" panel. See the upload path
  // (createUploadedStave) for staves that do ship real files.
  const effectiveFiles = useMemo<StavePackageFile[]>(
    () =>
      packageFiles.length > 0
        ? packageFiles
        : stave.body
          ? [{ path: "stave.md", content: stave.body }]
          : [],
    [packageFiles, stave.body],
  );

  const defaultPath =
    effectiveFiles.find((f) => f.path.endsWith("README.md"))?.path ??
    effectiveFiles[0]?.path ??
    "";

  const pathToContent = useMemo(() => {
    const map = new Map<string, string>();
    effectiveFiles.forEach((f) => map.set(f.path, f.content));
    return map;
  }, [effectiveFiles]);

  const tree = useMemo(() => buildTree(effectiveFiles), [effectiveFiles]);

  const [selectedPath, setSelectedPath] = useState(defaultPath);
  const [tab, setTab] = useState<"raw" | "preview">("preview");
  const [totals, setTotals] = useState(initialTotals);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [saved, setSaved] = useState(initialSaved);
  const [comments, setComments] = useState(initialComments);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [showPublish, setShowPublish] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [showAddToGrimoire, setShowAddToGrimoire] = useState(false);
  const [grimoireToast, setGrimoireToast] = useState<string | null>(null);
  const [showDownload, setShowDownload] = useState(false);
  const [downloadFolder, setDownloadFolder] = useState("");

  const content = selectedPath ? pathToContent.get(selectedPath) ?? "" : "";

  const isPublished = status === "published";

  const latestVersion = versions.length
    ? Math.max(...versions.map((v) => v.version))
    : stave.version;
  const latest = versions.find((v) => v.version === latestVersion);
  const hasNewer =
    status === "published" && latest != null && stave.version < latestVersion;

  const sendVote = (direction: 1 | -1) => {
    if (!isLoaded || !isSignedIn) return;
    const retract = userVote === direction;
    const nextValue = retract ? 0 : direction;

    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/staves/${stave.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: nextValue }),
        });
        if (!res.ok) throw new Error("Vote failed");
        const data = (await res.json()) as {
          upvotes: number;
          downvotes: number;
          userVote: 1 | -1 | 0;
        };
        setTotals({
          upvotes: data.upvotes,
          downvotes: data.downvotes,
          commentsCount: totals.commentsCount,
        });
        setUserVote(data.userVote);
      } catch {
        setError("Could not record vote.");
      }
    });
  };

  const toggleSave = () => {
    if (!isLoaded || !isSignedIn) return;
    startTransition(async () => {
      setError(null);
      const nextSaved = !saved;
      try {
        const res = await fetch(`/api/staves/${stave.id}/save`, {
          method: nextSaved ? "POST" : "DELETE",
        });
        if (!res.ok) throw new Error("Save failed");
        const data = (await res.json()) as { saved: boolean };
        setSaved(data.saved);
      } catch {
        setError("Could not update library.");
      }
    });
  };

  const submitComment = () => {
    const body = commentDraft.trim();
    if (!body || !isLoaded || !isSignedIn) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/staves/${stave.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (!res.ok) throw new Error("Comment failed");
        const data = (await res.json()) as {
          comments: StaveCommentDTO[];
          count: number;
        };
        setComments(data.comments);
        setCommentDraft("");
        setTotals((t) => ({ ...t, commentsCount: data.count }));
      } catch {
        setError("Could not post comment.");
      }
    });
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

  // Single-file staves download the raw markdown directly; multi-file packages
  // first ask for a parent-folder name (defaulting to the author's username).
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

  return (
    <div className="stave-detail-stack">
      <header className="stave-detail-head">
        <h1 className="stave-detail-title">{stave.title}</h1>
        <p className="stave-detail-author">
          by <Link href={sagaHref}>{authorName}</Link>
          <span className="tag" style={{ marginLeft: 8 }}>
            {stave.license}
          </span>
          {isAuthor ? (
            <span className="tag" style={{ marginLeft: 8 }}>
              {status === "published" ? "Published" : "Draft"}
            </span>
          ) : null}
        </p>
        {stave.description ? (
          <p className="stave-detail-desc">{stave.description}</p>
        ) : null}
        <div className="stave-detail-tags">
          {stave.tags.map((tag) => (
            <span key={`${stave.id}-${tag}`} className="tag">
              {tag}
            </span>
          ))}
        </div>

        {forkedFrom ? (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            <GitFork size={12} aria-hidden /> Forked from{" "}
            {forkedFrom.slug ? (
              <Link href={`/staves/${forkedFrom.slug}`}>{forkedFrom.title}</Link>
            ) : (
              <span>{forkedFrom.title}</span>
            )}
            {forkedFrom.authorUsername ? ` by ${forkedFrom.authorUsername}` : ""}
          </p>
        ) : null}

        {hasNewer && latest ? (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            A newer version is available —{" "}
            <Link href={`/staves/${latest.slug}`}>v{latest.version} →</Link>
          </p>
        ) : null}
      </header>

      <section className="stats-grid" aria-label="Stave statistics">
        <article className="stat-cell">
          <span className="stat-label">Upvotes</span>
          <span className="stat-value">{totals.upvotes.toLocaleString()}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Downvotes</span>
          <span className="stat-value">{totals.downvotes.toLocaleString()}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Comments</span>
          <span className="stat-value">{totals.commentsCount.toLocaleString()}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Registry views</span>
          <span className="stat-value">{stave.viewsCount.toLocaleString()}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Version</span>
          <span className="stat-value">v{stave.version}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Published</span>
          <span className="stat-value" style={{ fontSize: 15, fontWeight: 400 }}>
            {stave.publishedAt
              ? new Date(stave.publishedAt).toLocaleDateString()
              : "—"}
          </span>
        </article>
      </section>

      {versions.length > 1 ? (
        <section className="stack-sm" aria-label="Versions">
          <div className="stave-comments-head">
            <span>Versions</span>
          </div>
          <ul className="side-card-list">
            {versions.map((v) => (
              <li key={v.slug}>
                <Link href={`/staves/${v.slug}`}>
                  v{v.version}
                  {v.version === stave.version ? " (this version)" : ""}
                </Link>
                <small>
                  {v.publishedAt
                    ? new Date(v.publishedAt).toLocaleDateString()
                    : ""}
                  {v.releaseNotes ? ` · ${v.releaseNotes}` : ""}
                </small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="stave-inspector" aria-label="Stave package contents">
        <div className="stave-inspector-head">
          <h2 className="stave-inspector-title">Package</h2>
          <span className="stave-inspector-path">{selectedPath}</span>
        </div>
        <div className="stave-inspector-grid">
          <aside className="stave-tree-panel" aria-label="File tree">
            {tree.length === 0 ? (
              <p className="muted" style={{ padding: 12 }}>
                No package files for this stave.
              </p>
            ) : (
              <TreeList
                nodes={tree}
                depth={0}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            )}
          </aside>
          <div className="stave-markdown-panel">
            <div className="stave-md-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`stave-md-tab ${tab === "raw" ? "is-active" : ""}`}
                onClick={() => setTab("raw")}
              >
                Raw
              </button>
              <button
                type="button"
                role="tab"
                className={`stave-md-tab ${tab === "preview" ? "is-active" : ""}`}
                onClick={() => setTab("preview")}
              >
                Preview
              </button>
            </div>
            {tab === "raw" ? (
              <textarea
                className="stave-md-raw"
                readOnly
                value={content}
                spellCheck={false}
                aria-label="Raw markdown"
              />
            ) : (
              <article className="loom-preview stave-md-preview">
                {renderMarkdownPreview(content)}
              </article>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Engagement" className="stack-sm">
        <div className="stave-actions">
          {isPublished ? (
            <>
              <div className="stave-vote-group">
                <button
                  type="button"
                  className={`stave-action-btn ${userVote === 1 ? "is-active" : ""}`}
                  onClick={() => sendVote(1)}
                  disabled={!isLoaded || !isSignedIn || pending}
                  aria-pressed={userVote === 1}
                >
                  <ThumbsUp size={13} />
                  {totals.upvotes}
                </button>
                <button
                  type="button"
                  className={`stave-action-btn ${userVote === -1 ? "is-active" : ""}`}
                  onClick={() => sendVote(-1)}
                  disabled={!isLoaded || !isSignedIn || pending}
                  aria-pressed={userVote === -1}
                >
                  <ThumbsDown size={13} />
                  {totals.downvotes}
                </button>
              </div>
              <button
                type="button"
                className={`stave-action-btn ${saved ? "is-active" : ""}`}
                onClick={toggleSave}
                disabled={!isLoaded || !isSignedIn || pending}
              >
                <Bookmark size={13} />
                {saved ? "Saved" : "Save to library"}
              </button>
            </>
          ) : null}

          {isLoaded && isSignedIn && !isAuthor && isPublished ? (
            <button
              type="button"
              className="stave-action-btn"
              onClick={fork}
              disabled={pending}
            >
              <GitFork size={13} />
              {pending ? "Forking…" : "Fork"}
            </button>
          ) : null}

          {isLoaded && !isSignedIn && isPublished ? (
            <GaldrSignInButton>
              <span className="stave-action-btn">
                <GitFork size={13} />
                Sign in to fork
              </span>
            </GaldrSignInButton>
          ) : null}

          {isLoaded && isSignedIn && isPublished ? (
            <button
              type="button"
              className="stave-action-btn"
              onClick={() => setShowAddToGrimoire(true)}
              disabled={pending}
            >
              <BookMarked size={13} />
              Add to grimoire
            </button>
          ) : null}

          {isLoaded && !isSignedIn && isPublished ? (
            <GaldrSignInButton>
              <span className="stave-action-btn">
                <BookMarked size={13} />
                Sign in to add to a grimoire
              </span>
            </GaldrSignInButton>
          ) : null}

          <button
            type="button"
            className="stave-action-btn"
            onClick={startDownload}
            disabled={pending}
          >
            <Download size={13} />
            Download
          </button>

          <Link
            href={sagaHref}
            className="stave-action-link"
            style={{ marginLeft: "auto" }}
          >
            View saga →
          </Link>
        </div>

        {showDownload ? (
          <div className="stave-comment-compose" role="dialog" aria-label="Download package">
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
              This package has {effectiveFiles.length} files — they&apos;ll be zipped under
              this folder. Left blank, we use <strong>{authorName}</strong>.
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
                <Download size={13} />
                Download .zip
              </button>
            </div>
          </div>
        ) : null}

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

        {isAuthor ? (
          <div className="stave-actions">
            {status === "draft" ? (
              <>
                <Link href={`/loom?id=${stave.id}`} className="btn btn-soft btn-sm">
                  Edit in Loom
                </Link>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowPublish(true)}
                  disabled={pending}
                >
                  Publish
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={newVersion}
                disabled={pending}
              >
                New version
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={remove}
              disabled={pending}
            >
              Delete
            </button>
          </div>
        ) : null}

        {isPublished && isLoaded && !isSignedIn ? (
          <p className="muted" style={{ fontSize: 12.5 }}>
            <GaldrSignInButton>
              <button type="button" className="btn btn-ghost btn-sm">
                Sign in
              </button>
            </GaldrSignInButton>{" "}
            to vote, save, or comment.
          </p>
        ) : null}

        {error ? (
          <p className="stave-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {showPublish ? (
        <div className="stave-comment-compose" role="dialog" aria-label="Publish stave">
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
      ) : null}

      {isPublished ? (
      <section aria-label="Comments" className="stack-sm">
        <div className="stave-comments-head">
          <MessageCircle size={14} aria-hidden />
          <span>
            Comments <strong>{totals.commentsCount}</strong>
          </span>
        </div>

        <ul className="stave-comment-list">
          {comments.map((c) => (
            <li key={c.id} className="stave-comment">
              <div className="stave-comment-meta">
                <strong>{c.authorLabel}</strong>
                <span className="muted">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="stave-comment-body">{c.body}</p>
            </li>
          ))}
        </ul>

        {isLoaded && isSignedIn ? (
          <div className="stave-comment-compose">
            <label className="label-tiny" htmlFor="comment-input">
              Add a comment
            </label>
            <textarea
              id="comment-input"
              className="textarea"
              rows={4}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Invocation notes, bindings that worked, warnings..."
            />
            <div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={submitComment}
                disabled={pending || !commentDraft.trim()}
              >
                Post comment
              </button>
            </div>
          </div>
        ) : null}
      </section>
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
