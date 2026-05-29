"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Bookmark, Download, GitFork, Play, ThumbsDown, ThumbsUp } from "lucide-react";

import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import { GrimoireEntryRow, type EntryDTO } from "@/components/grimoires/GrimoireEntryRow";
import { renderMarkdownPreview } from "@/lib/markdownPreview";

export type GrimoireDetailProps = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  details: string | null;
  tags: string[];
  license: string;
  version: number;
  isOrchestration: boolean;
  authorName: string;
  sagaHref: string;
  isAuthor: boolean;
  isSignedIn: boolean;
  status: "draft" | "published";
  entries: EntryDTO[];
  sourcesCount: number;
  forkCount: number;
  downloadsCount: number;
  lastUpdated: string | null;
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote: 1 | -1 | 0;
  initialSaved: boolean;
};

export function GrimoireDetailClient(props: GrimoireDetailProps) {
  const router = useRouter();
  const [toggledOff, setToggledOff] = useState<Set<string>>(new Set());
  const [upvotes, setUpvotes] = useState(props.initialUpvotes);
  const [downvotes, setDownvotes] = useState(props.initialDownvotes);
  const [userVote, setUserVote] = useState(props.initialUserVote);
  const [saved, setSaved] = useState(props.initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isPublished = props.status === "published";

  const downloadHref = useMemo(() => {
    const off = [...toggledOff];
    const base = `/api/grimoires/${props.id}/download`;
    return off.length ? `${base}?exclude=${off.join(",")}` : base;
  }, [toggledOff, props.id]);

  const toggle = (entryId: string) => {
    setToggledOff((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const sendVote = (direction: 1 | -1) => {
    if (!props.isSignedIn) return;
    const retract = userVote === direction;
    const nextValue = retract ? 0 : direction;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/grimoires/${props.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: nextValue }),
        });
        if (!res.ok) throw new Error();
        // Optimistic local adjustment.
        setUpvotes((u) => u - (userVote === 1 ? 1 : 0) + (nextValue === 1 ? 1 : 0));
        setDownvotes((d) => d - (userVote === -1 ? 1 : 0) + (nextValue === -1 ? 1 : 0));
        setUserVote(nextValue);
      } catch {
        setError("Could not record vote.");
      }
    });
  };

  const toggleSave = () => {
    if (!props.isSignedIn) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/grimoires/${props.id}/save`, { method: "POST" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { saved: boolean };
        setSaved(data.saved);
      } catch {
        setError("Could not update library.");
      }
    });
  };

  const fork = () => {
    if (!props.isSignedIn) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/grimoires/${props.id}/fork`, { method: "POST" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { id: string };
        router.push(`/grimoires/${data.id}/edit`);
      } catch {
        setError("Could not fork grimoire.");
      }
    });
  };

  return (
    <div className="stave-detail-stack">
      <header className="stave-detail-head">
        <h1 className="stave-detail-title">{props.title}</h1>
        <p className="stave-detail-author">
          by <Link href={props.sagaHref}>{props.authorName}</Link>
          <span className="tag" style={{ marginLeft: 8 }}>
            {props.license}
          </span>
          <span className="tag" style={{ marginLeft: 8 }}>
            v{props.version}
          </span>
          {props.isAuthor ? (
            <span className="tag" style={{ marginLeft: 8 }}>
              {isPublished ? "Published" : "Draft"}
            </span>
          ) : null}
        </p>
        {props.shortDescription ? (
          <p className="stave-detail-desc">{props.shortDescription}</p>
        ) : null}
        <div className="stave-detail-tags">
          {props.isOrchestration ? (
            <span className="tag" data-orchestration="true">
              orchestration
            </span>
          ) : null}
          {props.tags
            .filter((t) => t !== "orchestration")
            .map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
        </div>

        <div className="stave-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="stave-action-btn"
            disabled
            title="Runtime coming soon — download the package and run with your agent"
          >
            <Play size={13} /> Run all
          </button>

          {isPublished && props.isSignedIn && !props.isAuthor ? (
            <button
              type="button"
              className="stave-action-btn"
              onClick={fork}
              disabled={pending}
            >
              <GitFork size={13} /> {pending ? "Forking…" : "Fork"}
            </button>
          ) : null}
          {isPublished && !props.isSignedIn ? (
            <GaldrSignInButton>
              <span className="stave-action-btn">
                <GitFork size={13} /> Sign in to fork
              </span>
            </GaldrSignInButton>
          ) : null}

          {isPublished ? (
            <button
              type="button"
              className={`stave-action-btn ${saved ? "is-active" : ""}`}
              onClick={toggleSave}
              disabled={!props.isSignedIn || pending}
            >
              <Bookmark size={13} /> {saved ? "Saved" : "Save"}
            </button>
          ) : null}
        </div>
      </header>

      <section className="stats-grid" aria-label="Grimoire statistics">
        <article className="stat-cell">
          <span className="stat-label">Forks</span>
          <span className="stat-value">{props.forkCount.toLocaleString()}</span>
        </article>
        <article className="stat-cell">
          <span className="stat-label">Downloads</span>
          <span className="stat-value">{props.downloadsCount.toLocaleString()}</span>
        </article>
        <article className="stat-cell" aria-hidden data-reserved="true">
          <span className="stat-label">Runs</span>
          <span className="stat-value muted">—</span>
        </article>
      </section>

      <div className="col-grid" style={{ paddingTop: 4 }}>
        <div>
          <div className="section-head">
            <h2>Staves</h2>
            <span className="muted">
              {props.entries.length} · {props.sourcesCount}{" "}
              {props.sourcesCount === 1 ? "source" : "sources"}
            </span>
          </div>
          {props.entries.length === 0 ? (
            <p className="muted" style={{ padding: "24px 0" }}>
              This grimoire has no staves yet.
            </p>
          ) : (
            <ol className="grimoire-entry-list">
              {props.entries.map((entry, i) => (
                <GrimoireEntryRow
                  key={entry.id}
                  entry={entry}
                  position={i + 1}
                  isLast={i === props.entries.length - 1}
                  toggledOff={toggledOff.has(entry.id)}
                  onToggle={() => toggle(entry.id)}
                />
              ))}
            </ol>
          )}

          {props.details ? (
            <section className="stack-sm" style={{ marginTop: 24 }}>
              <div className="stave-comments-head">
                <span>Author notes</span>
              </div>
              <article className="loom-preview stave-md-preview">
                {renderMarkdownPreview(props.details)}
              </article>
            </section>
          ) : null}

          {error ? (
            <p className="stave-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <aside className="stack" style={{ gap: 16 }}>
          <section className="side-card">
            <h3 className="side-card-title">Run / download</h3>
            <button
              type="button"
              className="btn btn-soft btn-sm"
              disabled
              title="Runtime coming soon — download the package and run with your agent"
              style={{ width: "100%", marginBottom: 8 }}
            >
              <Play size={13} /> Run all
            </button>
            {isPublished ? (
              <a className="btn btn-ghost btn-sm" href={downloadHref} style={{ width: "100%" }}>
                <Download size={13} /> Download package
              </a>
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>
                Publish to enable downloads.
              </p>
            )}
          </section>

          {isPublished ? (
            <section className="side-card">
              <h3 className="side-card-title">Engagement</h3>
              <div className="stave-vote-group">
                <button
                  type="button"
                  className={`stave-action-btn ${userVote === 1 ? "is-active" : ""}`}
                  onClick={() => sendVote(1)}
                  disabled={!props.isSignedIn || pending}
                  aria-pressed={userVote === 1}
                >
                  <ThumbsUp size={13} /> {upvotes}
                </button>
                <button
                  type="button"
                  className={`stave-action-btn ${userVote === -1 ? "is-active" : ""}`}
                  onClick={() => sendVote(-1)}
                  disabled={!props.isSignedIn || pending}
                  aria-pressed={userVote === -1}
                >
                  <ThumbsDown size={13} /> {downvotes}
                </button>
              </div>
            </section>
          ) : null}

          <section className="side-card">
            <h3 className="side-card-title">Curator</h3>
            <div className="grimoire-curator">
              <span className="grimoire-avatar" aria-hidden>
                {props.authorName.charAt(0).toUpperCase()}
              </span>
              <div>
                <Link href={props.sagaHref}>
                  <strong>{props.authorName}</strong>
                </Link>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  View saga →
                </p>
              </div>
            </div>
          </section>

          <section className="side-card">
            <h3 className="side-card-title">Details</h3>
            <ul className="side-card-list">
              <li>
                <span>Version</span>
                <small>v{props.version}</small>
              </li>
              <li>
                <span>License</span>
                <small>{props.license}</small>
              </li>
              <li>
                <span>Staves</span>
                <small>{props.entries.length}</small>
              </li>
              <li>
                <span>Sources</span>
                <small>{props.sourcesCount}</small>
              </li>
              <li>
                <span>Updated</span>
                <small>{props.lastUpdated ?? "—"}</small>
              </li>
            </ul>
          </section>

          {props.isAuthor ? (
            <section className="side-card">
              <h3 className="side-card-title">Owner</h3>
              {isPublished ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%" }}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await fetch(
                        `/api/grimoires/${props.id}/new-version`,
                        { method: "POST" },
                      );
                      if (res.ok) {
                        const data = (await res.json()) as { id: string };
                        router.push(`/grimoires/${data.id}/edit`);
                      }
                    })
                  }
                >
                  New version
                </button>
              ) : (
                <Link
                  href={`/grimoires/${props.id}/edit`}
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%" }}
                >
                  Edit draft
                </Link>
              )}
            </section>
          ) : null}

          <section className="side-card">
            <h3 className="side-card-title">Related grimoires</h3>
            <p className="muted" style={{ fontSize: 12 }}>
              No related grimoires yet.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
