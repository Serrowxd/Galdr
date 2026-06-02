"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Bookmark,
  Boxes,
  Download,
  FileText,
  GitFork,
  Layers,
  Play,
  ThumbsDown,
  ThumbsUp,
  Workflow,
} from "lucide-react";

import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import { GrimoireEntryRow, type EntryDTO } from "@/components/grimoires/GrimoireEntryRow";
import { renderMarkdownPreview } from "@/lib/markdownPreview";
import { defaultGrimoireTab, type GrimoireTabId } from "@/lib/grimoireTabs";
import type { GrimoireVersion } from "@/lib/grimoires";

export type GrimoireDetailProps = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  readme: string | null;
  orchestrationDoc: string | null;
  tags: string[];
  license: string;
  version: number;
  isOrchestration: boolean;
  authorName: string;
  authorAvatarUrl: string | null;
  sagaHref: string;
  isAuthor: boolean;
  isSignedIn: boolean;
  status: "draft" | "published";
  initialTab: GrimoireTabId;
  entries: EntryDTO[];
  versions: GrimoireVersion[];
  sourcesCount: number;
  forkCount: number;
  downloadsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  initialUpvotes: number;
  initialDownvotes: number;
  initialUserVote: 1 | -1 | 0;
  initialSaved: boolean;
};

// The immutable folder sentinel — selecting it shows the vertical stave view.
const STAVES_NODE = "STAVES";

type GrimoireDoc = {
  path: string;
  content: string;
  kind: "readme" | "orchestration";
};

function timeAgo(date: string | null): string {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
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
  const hasReadme = Boolean(props.readme && props.readme.trim());

  // The grimoire's root files — README plus (when an orchestration) the
  // orchestration definition. The STAVES folder is added to the tree separately.
  const docs = useMemo<GrimoireDoc[]>(() => {
    const list: GrimoireDoc[] = [];
    if (hasReadme) list.push({ path: "README.md", content: props.readme!, kind: "readme" });
    if (props.isOrchestration) {
      list.push({
        path: "orchestration.md",
        content: props.orchestrationDoc ?? "",
        kind: "orchestration",
      });
    }
    return list;
  }, [hasReadme, props.readme, props.isOrchestration, props.orchestrationDoc]);

  // --- tabs: instant client swap, URL kept in sync for deep-links/refresh ----
  const defaultTab = defaultGrimoireTab(hasReadme);
  const [tab, setTab] = useState<GrimoireTabId>(props.initialTab);
  const activeTab: GrimoireTabId =
    (tab === "readme" && !hasReadme) ||
    (tab === "orchestration" && !props.isOrchestration)
      ? defaultTab
      : tab;
  const selectTab = (next: GrimoireTabId) => {
    setTab(next);
    if (typeof window !== "undefined") {
      const url =
        next === defaultTab
          ? `/grimoires/${props.slug}`
          : `/grimoires/${props.slug}?tab=${next}`;
      window.history.replaceState(null, "", url);
    }
  };

  const tabDefs: { id: GrimoireTabId; label: string; badge: number | null }[] = [
    ...(hasReadme ? [{ id: "readme" as const, label: "Readme", badge: null }] : []),
    { id: "files", label: "Files", badge: docs.length + 1 },
    ...(props.isOrchestration
      ? [{ id: "orchestration" as const, label: "Orchestration", badge: null }]
      : []),
    { id: "discussion", label: "Discussion", badge: 0 },
    { id: "versions", label: "Versions", badge: props.versions.length },
  ];

  // --- Files inspector: which tree node is open + raw/formatted toggle -------
  const [selectedNode, setSelectedNode] = useState<string>(STAVES_NODE);
  const [fileView, setFileView] = useState<"preview" | "raw">("preview");
  const selectedDoc = docs.find((d) => d.path === selectedNode) ?? null;

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

  const newVersion = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/grimoires/${props.id}/new-version`, {
          method: "POST",
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { id: string };
        router.push(`/grimoires/${data.id}/edit`);
      } catch {
        setError("Could not start a new version.");
      }
    });
  };

  const visibleTags = props.tags.filter((t) => t !== "orchestration").slice(0, 5);
  const extraTags =
    props.tags.filter((t) => t !== "orchestration").length - visibleTags.length;
  const updatedAt = props.updatedAt ?? props.publishedAt ?? props.createdAt;

  // The vertical stave view — orchestration pinned on top, then the entries.
  const staveView = (
    <>
      {props.isOrchestration ? (
        <button
          type="button"
          className="grimoire-orch-entry"
          onClick={() => {
            setSelectedNode("orchestration.md");
            setFileView("preview");
          }}
          title="Open orchestration.md"
        >
          <Workflow size={16} aria-hidden />
          <span>
            Orchestration
            <span className="grimoire-orch-entry-sub">
              {" "}
              — these staves run as a coordinated workflow. Open{" "}
              <code>orchestration.md</code>.
            </span>
          </span>
        </button>
      ) : null}

      {props.entries.length === 0 ? (
        <p className="stave08-empty">This grimoire has no staves yet.</p>
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
    </>
  );

  return (
    <div className="stave08">
      {/* HEADER */}
      <header className="stave08-head">
        <div className="stave08-titleblock">
          <h1 className="stave08-title">{props.title}</h1>
          <div className="stave08-slug">{props.slug}</div>
          <p className="stave08-subline">
            {props.shortDescription ?? "No description provided."}
          </p>
          <div className="stave08-meta">
            <span className="stave08-ver">v{props.version}</span>
            <span className="stave08-meta-label">updated {timeAgo(updatedAt)}</span>
            {props.isAuthor ? (
              <span className="tag">{isPublished ? "Published" : "Draft"}</span>
            ) : null}
            {props.isOrchestration ? (
              <span className="tag" data-orchestration="true">
                orchestration
              </span>
            ) : null}
            <span className="tag">{props.license}</span>
            {visibleTags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
            {extraTags > 0 ? <span className="tag">+{extraTags} more</span> : null}
          </div>
        </div>

        <div className="stave08-actions">
          <div className="stave08-actionrow">
            <button
              type="button"
              className="btn btn-ghost"
              disabled
              title="Runtime coming soon — download the package and run with your agent"
            >
              <Play size={14} /> Run all
            </button>

            {isPublished && props.isSignedIn && !props.isAuthor ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={fork}
                disabled={pending}
              >
                <GitFork size={14} /> {pending ? "Forking…" : "Fork"}
              </button>
            ) : null}
            {isPublished && !props.isSignedIn ? (
              <GaldrSignInButton>
                <span className="btn btn-ghost">
                  <GitFork size={14} /> Fork
                </span>
              </GaldrSignInButton>
            ) : null}

            {isPublished && props.isSignedIn ? (
              <button
                type="button"
                className={`btn btn-ghost ${saved ? "btn-accent" : ""}`}
                onClick={toggleSave}
                disabled={pending}
              >
                <Bookmark size={14} /> {saved ? "Saved" : "Save"}
              </button>
            ) : null}
            {isPublished && !props.isSignedIn ? (
              <GaldrSignInButton>
                <span className="btn btn-ghost">
                  <Bookmark size={14} /> Save
                </span>
              </GaldrSignInButton>
            ) : null}

            {isPublished ? (
              <a className="btn btn-primary" href={downloadHref}>
                <Download size={14} /> Download
              </a>
            ) : null}
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
            className={`stave08-tab ${activeTab === t.id ? "is-active" : ""} ${
              t.id === "orchestration" ? "is-orchestration" : ""
            }`}
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
            hasReadme ? (
              <article className="loom-preview stave-md-preview stave08-readme">
                {renderMarkdownPreview(props.readme!)}
              </article>
            ) : (
              <p className="stave08-empty">This grimoire has no README.</p>
            )
          ) : null}

          {activeTab === "files" ? (
            <section className="stave-inspector" aria-label="Grimoire contents">
              <div className="stave-inspector-grid">
                <aside className="stave-tree-panel" aria-label="File tree">
                  <ul className="stave-tree-list">
                    {docs.map((d) => (
                      <li key={d.path}>
                        <button
                          type="button"
                          className={`stave-tree-row stave-tree-file ${
                            d.kind === "orchestration" ? "is-orchestration" : ""
                          } ${selectedNode === d.path ? "is-active" : ""}`}
                          onClick={() => setSelectedNode(d.path)}
                        >
                          {d.kind === "orchestration" ? (
                            <Workflow size={13} aria-hidden />
                          ) : (
                            <FileText size={13} aria-hidden />
                          )}
                          <span>{d.path}</span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        className={`stave-tree-row stave-tree-folder is-selectable ${
                          selectedNode === STAVES_NODE ? "is-active" : ""
                        }`}
                        onClick={() => setSelectedNode(STAVES_NODE)}
                        title="The staves in this grimoire (read-only)"
                      >
                        <Boxes size={13} aria-hidden />
                        <span>STAVES</span>
                        <span className="tag" style={{ marginLeft: 4 }}>
                          {props.entries.length}
                        </span>
                      </button>
                    </li>
                  </ul>
                </aside>

                <div className="stave-markdown-panel">
                  <div className="stave-md-tabs" role="tablist">
                    <span
                      className="stave-inspector-path"
                      style={{ marginRight: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      {selectedNode === STAVES_NODE ? (
                        <>
                          <Layers size={12} aria-hidden /> STAVES/
                        </>
                      ) : (
                        selectedNode
                      )}
                    </span>
                    {selectedDoc ? (
                      <>
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
                      </>
                    ) : null}
                  </div>

                  {selectedNode === STAVES_NODE ? (
                    <div className="stave-md-preview">{staveView}</div>
                  ) : selectedDoc ? (
                    fileView === "raw" ? (
                      <textarea
                        className="stave-md-raw"
                        readOnly
                        value={selectedDoc.content}
                        spellCheck={false}
                        aria-label="Raw file content"
                      />
                    ) : selectedDoc.content.trim() ? (
                      <article className="loom-preview stave-md-preview">
                        {renderMarkdownPreview(selectedDoc.content)}
                      </article>
                    ) : (
                      <p className="stave08-empty" style={{ padding: 18 }}>
                        This file is empty.
                      </p>
                    )
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "orchestration" ? (
            <div className="grimoire-orch-planned">
              <Workflow size={22} aria-hidden />
              <span className="grimoire-orch-planned-title">
                Orchestration is a planned feature
              </span>
              <p>
                A future release will turn this grimoire&apos;s staves into a runnable,
                visual workflow — sequencing, hand-offs, and parallel groups. For now,
                the run order lives in <code>orchestration.md</code> under the Files tab.
              </p>
            </div>
          ) : null}

          {activeTab === "discussion" ? (
            <p className="stave08-empty">
              No discussion yet — threads arrive with the Tavern. This tab will hold
              the grimoire&apos;s discussion plus Q&amp;A and showcase threads.
            </p>
          ) : null}

          {activeTab === "versions" ? (
            props.versions.length === 0 ? (
              <p className="stave08-empty">No published versions yet.</p>
            ) : (
              <ul className="stave08-list">
                {props.versions.map((v) => (
                  <li key={v.slug}>
                    <div className="stave08-list-main">
                      <Link href={`/grimoires/${v.slug}`}>
                        v{v.version}
                        {v.version === props.version ? " · this version" : ""}
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
            <h3 className="side-card-title">Curator</h3>
            <div className="stave08-maint">
              {props.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="stave08-avatar"
                  src={props.authorAvatarUrl}
                  alt=""
                  aria-hidden
                />
              ) : (
                <span className="stave08-avatar" aria-hidden>
                  {props.authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <Link href={props.sagaHref} className="stave08-maint-name">
                  {props.authorName}
                </Link>
                <div className="stave08-maint-sub">
                  {props.entries.length}{" "}
                  {props.entries.length === 1 ? "stave" : "staves"} ·{" "}
                  {props.sourcesCount}{" "}
                  {props.sourcesCount === 1 ? "source" : "sources"}
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
            <h3 className="side-card-title">Run / download</h3>
            <button
              type="button"
              className="btn btn-soft btn-sm btn-block"
              disabled
              title="Runtime coming soon — download the package and run with your agent"
            >
              <Play size={13} /> Run all
            </button>
            {isPublished ? (
              <a className="btn btn-ghost btn-sm btn-block" href={downloadHref}>
                <Download size={13} /> Download package
              </a>
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>
                Publish to enable downloads.
              </p>
            )}
            {toggledOff.size > 0 ? (
              <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                <Layers size={11} aria-hidden /> {toggledOff.size} optional{" "}
                {toggledOff.size === 1 ? "stave" : "staves"} excluded.
              </p>
            ) : null}
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
                <span>Forks</span>
                <small>{props.forkCount.toLocaleString()}</small>
              </li>
              <li>
                <span>Downloads</span>
                <small>{props.downloadsCount.toLocaleString()}</small>
              </li>
              <li>
                <span>Updated</span>
                <small>{timeAgo(updatedAt)}</small>
              </li>
            </ul>
          </section>

          {props.isAuthor ? (
            <section className="side-card">
              <h3 className="side-card-title">Owner</h3>
              {isPublished ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-block"
                  disabled={pending}
                  onClick={newVersion}
                >
                  New version
                </button>
              ) : (
                <Link
                  href={`/grimoires/${props.id}/edit`}
                  className="btn btn-primary btn-sm btn-block"
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
