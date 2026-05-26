"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bookmark,
  ChevronRight,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import { renderMarkdownPreview } from "@/lib/markdownPreview";
import type { Stave } from "@/lib/mockData";
import type { StavePackageFile } from "@/lib/stavePackages";

export type StaveCommentDTO = {
  id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
};

type TreeDir = { kind: "dir"; name: string; nodes: TreeNode[] };
type TreeFile = { kind: "file"; name: string; path: string };
type TreeNode = TreeDir | TreeFile;

function buildTree(files: StavePackageFile[]): TreeNode[] {
  type MDir = { kind: "dir"; name: string; nodes: MNode[] };
  type MFile = { kind: "file"; name: string; path: string };
  type MNode = MDir | MFile;

  const root: MDir = { kind: "dir", name: "", nodes: [] };
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split("/").filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        cursor.nodes.push({ kind: "file", name: segment, path: file.path });
      } else {
        let next = cursor.nodes.find(
          (n): n is MDir => n.kind === "dir" && n.name === segment,
        );
        if (!next) {
          next = { kind: "dir", name: segment, nodes: [] };
          cursor.nodes.push(next);
        }
        cursor = next;
      }
    }
  }

  const sortNodes = (nodes: MNode[]): TreeNode[] => {
    const dirs = nodes.filter((n): n is MDir => n.kind === "dir");
    const leafs = nodes.filter((n): n is MFile => n.kind === "file");
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    leafs.sort((a, b) => a.name.localeCompare(b.name));
    return [
      ...dirs.map((d) => ({
        kind: "dir" as const,
        name: d.name,
        nodes: sortNodes(d.nodes),
      })),
      ...leafs,
    ];
  };

  return sortNodes(root.nodes);
}

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
  packageFiles: StavePackageFile[];
  grimoireHref: string;
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
  packageFiles,
  grimoireHref,
  initialTotals,
  initialUserVote,
  initialSaved,
  initialComments,
}: StaveDetailClientProps) {
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

  const defaultPath =
    packageFiles.find((f) => f.path.endsWith("README.md"))?.path ??
    packageFiles[0]?.path ??
    "";

  const pathToContent = useMemo(() => {
    const map = new Map<string, string>();
    packageFiles.forEach((f) => map.set(f.path, f.content));
    return map;
  }, [packageFiles]);

  const tree = useMemo(() => buildTree(packageFiles), [packageFiles]);

  const [selectedPath, setSelectedPath] = useState(defaultPath);
  const [tab, setTab] = useState<"raw" | "preview">("preview");
  const [totals, setTotals] = useState(initialTotals);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [saved, setSaved] = useState(initialSaved);
  const [comments, setComments] = useState(initialComments);
  const [commentDraft, setCommentDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const content = selectedPath ? pathToContent.get(selectedPath) ?? "" : "";

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
        const data = (await res.json()) as { comments: StaveCommentDTO[]; count: number };
        setComments(data.comments);
        setCommentDraft("");
        setTotals((t) => ({ ...t, commentsCount: data.count }));
      } catch {
        setError("Could not post comment.");
      }
    });
  };

  return (
    <div className="stave-detail-stack">
      <header className="stave-detail-head">
        <h1 className="stave-detail-title">{stave.title}</h1>
        <p className="stave-detail-author">
          by{" "}
          <Link href={grimoireHref}>
            {stave.scribe}
          </Link>
        </p>
        <p className="stave-detail-desc">{stave.description}</p>
        <div className="stave-detail-tags">
          {stave.tags.map((tag) => (
            <span key={`${stave.id}-${tag}`} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </header>

      <section className="stats-grid" aria-label="Stave statistics">
        <article className="stat-cell">
          <span className="stat-label">Invocations</span>
          <span className="stat-value">{stave.invocations.toLocaleString()}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Bindings</span>
          <span className="stat-value">{stave.bindings}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Success rate</span>
          <span className="stat-value success">{stave.successRate}%</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Registry views</span>
          <span className="stat-value">{stave.viewsCount.toLocaleString()}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Popularity</span>
          <span className="stat-value">{stave.popularityScore}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Published</span>
          <span className="stat-value" style={{ fontSize: 15, fontWeight: 400 }}>
            {new Date(stave.publishedAt).toLocaleDateString()}
          </span>
        </article>
      </section>

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
          <span className="meta-item">
            <Zap size={12} aria-hidden />
            {stave.invocations.toLocaleString()} invocations
          </span>
          <span className="meta-item">
            <span className="success-dot" aria-hidden />
            {stave.successRate}% reliable
          </span>
          <Link href={grimoireHref} className="stave-action-link" style={{ marginLeft: "auto" }}>
            View grimoire →
          </Link>
        </div>

        {isLoaded && !isSignedIn ? (
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
    </div>
  );
}
