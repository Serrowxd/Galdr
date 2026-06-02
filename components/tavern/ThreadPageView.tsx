import Link from "next/link";

import type { ThreadDetail, CommentRow, ThreadFeedRow } from "@/lib/threads";
import { extractHeadings } from "@/lib/markdown/extractHeadings";
import { renderMarkdownPreview } from "@/lib/markdownPreview";
import { ViewBeacon } from "@/components/tavern/ViewBeacon";
import { InlineComposer } from "@/components/tavern/InlineComposer";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  const diffM = Math.floor(diffD / 30);
  return `${diffM}mo ago`;
}

function formatEditedRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "EDITED JUST NOW";
  if (diffH < 24) return `EDITED ${diffH}H AGO`;
  const diffD = Math.floor(diffH / 24);
  return `EDITED ${diffD}D AGO`;
}

// ─── sub-components ─────────────────────────────────────────────────────────

function ThreadBreadcrumb({ title }: { title: string }) {
  return (
    <nav className="thread-breadcrumb" aria-label="Breadcrumb">
      <Link href="/tavern">Tavern</Link>
      <span className="thread-breadcrumb-sep" aria-hidden>/</span>
      <span className="thread-breadcrumb-current">{title}</span>
    </nav>
  );
}

function OpCard({
  thread,
  isAuthor,
}: {
  thread: ThreadDetail;
  isAuthor: boolean;
}) {
  return (
    <div className="thread-op">
      <div className="thread-op-head">
        <div className="thread-op-meta">
          <span className="thread-op-author">
            {thread.author.username ?? "unknown"}
          </span>
          {isAuthor && <span className="author-chip">YOU</span>}
          <span className="thread-op-time">{formatRelativeTime(thread.createdAt)}</span>
          {thread.opEditedAt && (
            <span className="thread-op-edited">{formatEditedRelative(thread.opEditedAt)}</span>
          )}
        </div>
        <div className="thread-op-stats">
          <span className="thread-op-score">↑ {thread.voteScore}</span>
          {/* VoteStack goes here — GALDR-14 */}
        </div>
      </div>

      {thread.category && (
        <span className="thread-category-chip">{thread.category}</span>
      )}

      {thread.tags.length > 0 && (
        <div className="thread-op-tags">
          {thread.tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}

      {thread.opBody && (
        <div className="thread-op-body">
          {renderMarkdownPreview(thread.opBody)}
        </div>
      )}
    </div>
  );
}

function DocHeader({ thread }: { thread: ThreadDetail }) {
  return (
    <header className="doc-header">
      <h1 className="doc-title">{thread.title}</h1>
      <div className="doc-header-meta">
        <span className="doc-author">{thread.author.username ?? "unknown"}</span>
        <span className="doc-time">{formatRelativeTime(thread.createdAt)}</span>
        {thread.opEditedAt && (
          <span className="doc-edited">{formatEditedRelative(thread.opEditedAt)}</span>
        )}
        <span className="doc-stat">↑ {thread.voteScore}</span>
        {/* VoteStack goes here — GALDR-14 */}
      </div>
      {thread.tags.length > 0 && (
        <div className="doc-header-tags">
          {thread.tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}
    </header>
  );
}

function CommentSortBar({
  sort,
  count,
  slug,
}: {
  sort: string;
  count: number;
  slug: string;
}) {
  return (
    <div className="comment-sort-bar">
      <span className="comment-sort-count">
        {count} {count === 1 ? "comment" : "comments"}
      </span>
      <div className="comment-sort-controls">
        <Link
          href={`/tavern/${slug}?sort=top`}
          className={`comment-sort-btn${sort !== "new" ? " is-active" : ""}`}
        >
          Top
        </Link>
        <Link
          href={`/tavern/${slug}?sort=new`}
          className={`comment-sort-btn${sort === "new" ? " is-active" : ""}`}
        >
          New
        </Link>
      </div>
    </div>
  );
}

function CommentArticle({
  comment,
  isReply,
  threadSlug,
}: {
  comment: CommentRow;
  isReply: boolean;
  threadSlug: string;
}) {
  return (
    <article
      id={`c${comment.id}`}
      className={`comment${isReply ? " comment--reply" : ""}`}
    >
      <div className="comment-head">
        <span className="comment-author">
          {comment.authorUsername ?? "unknown"}
        </span>
        {comment.isStaveAuthor && (
          <span className="author-chip">AUTHOR</span>
        )}
        <span className="comment-time">{formatRelativeTime(comment.createdAt)}</span>
        {comment.editedAt && (
          <span className="comment-edited">{formatEditedRelative(comment.editedAt)}</span>
        )}
        <span className="comment-score">↑ {comment.voteScore}</span>
      </div>

      <div className="comment-body">
        {renderMarkdownPreview(comment.body)}
      </div>

      <div className="comment-actions">
        {/* VoteMini — GALDR-14 */}
        <button className="comment-action-btn" disabled>
          REPLY
        </button>
        <a
          href={`/tavern/${threadSlug}#c${comment.id}`}
          className="comment-action-btn"
        >
          SHARE
        </a>
        {/* ReplyComposer for comment {comment.id} — GALDR-13 */}
      </div>
    </article>
  );
}

function CommentTree({
  comments,
  threadSlug,
}: {
  comments: CommentRow[];
  threadSlug: string;
}) {
  if (comments.length === 0) {
    return (
      <div className="comment-empty">
        <p>No comments yet. Be the first to reply.</p>
      </div>
    );
  }

  return (
    <div className="comment-tree">
      {comments.map((c) => (
        <div key={c.id} className="comment-thread-item">
          <CommentArticle comment={c} isReply={false} threadSlug={threadSlug} />
          {c.replies.length > 0 && (
            <div className="comment-replies">
              {c.replies.map((r) => (
                <CommentArticle
                  key={r.id}
                  comment={r}
                  isReply={true}
                  threadSlug={threadSlug}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AttachedStavePanel({
  stave,
  mini,
}: {
  stave: { slug: string; title: string; authorUsername: string | null };
  mini?: boolean;
}) {
  return (
    <div className={`thread-rail-card${mini ? " thread-rail-card--mini" : ""}`}>
      <div className="thread-rail-card-title">ATTACHED STAVE</div>
      <Link href={`/staves/${stave.slug}`} className="thread-stave-link">
        <div className="thread-stave-link-title">{stave.title}</div>
        {stave.authorUsername && (
          <div className="thread-stave-link-author">by {stave.authorUsername}</div>
        )}
      </Link>
    </div>
  );
}

function RelatedPanel({ threads: relatedThreads }: { threads: ThreadFeedRow[] }) {
  if (relatedThreads.length === 0) return null;
  return (
    <div className="thread-rail-card">
      <div className="thread-rail-card-title">RELATED THREADS</div>
      <ul className="thread-rail-list">
        {relatedThreads.map((t) => (
          <li key={t.id}>
            <Link href={`/tavern/${t.slug}`} className="thread-rail-link">
              <span className="thread-rail-link-title">{t.title}</span>
              <span className="thread-rail-link-meta">
                ↑ {t.voteScore} · {t.commentsCount}c
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutlineList({
  headings,
}: {
  headings: ReturnType<typeof extractHeadings>;
}) {
  if (headings.length === 0) return null;
  return (
    <div className="thread-rail-card">
      <div className="thread-rail-card-title">OUTLINE</div>
      <ul className="doc-outline-list">
        {headings.map((h) => (
          <li
            key={h.id}
            className={`doc-outline-item doc-outline-item--h${h.level}`}
          >
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

type ThreadPageViewProps = {
  thread: ThreadDetail;
  comments: CommentRow[];
  related: ThreadFeedRow[];
  staveCard: { slug: string; title: string; authorUsername: string | null } | null;
  surface: "forum" | "doc";
  isAuthor: boolean;
  isStaveAuthor: boolean;
  viewerId: string | null;
  sort?: string;
};

// ─── Main component ─────────────────────────────────────────────────────────

export function ThreadPageView({
  thread,
  comments,
  related,
  staveCard,
  surface,
  isAuthor,
  viewerId,
  sort = "top",
}: ThreadPageViewProps) {
  // Fire-and-forget view increment via client beacon
  const beacon = <ViewBeacon threadId={thread.id} />;

  if (surface === "doc") {
    const headings = extractHeadings(thread.opBody);
    return (
      <div className="container">
        {beacon}
        <div className="thread-page thread-page--doc">
          {/* Left: doc meta rail */}
          <aside className="doc-meta-rail">
            <span className="doc-mode-chip">DOC MODE</span>
            <div className="doc-meta-stats">
              <div className="doc-meta-stat">
                <span className="doc-meta-stat-label">VIEWS</span>
                <span className="doc-meta-stat-value">{thread.viewsCount}</span>
              </div>
              <div className="doc-meta-stat">
                <span className="doc-meta-stat-label">VOTES</span>
                <span className="doc-meta-stat-value">{thread.voteScore}</span>
              </div>
              <div className="doc-meta-stat">
                <span className="doc-meta-stat-label">COMMENTS</span>
                <span className="doc-meta-stat-value">{thread.commentsCount}</span>
              </div>
            </div>
            {thread.tags.length > 0 && (
              <div className="doc-meta-tags">
                {thread.tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}
            {/* ReadingProgressBar stub */}
            <div className="doc-reading-progress" aria-hidden />
          </aside>

          {/* Center: article */}
          <article className="doc-article">
            <ThreadBreadcrumb title={thread.title} />
            <DocHeader thread={thread} />
            <div className="doc-body">
              {thread.opBody ? renderMarkdownPreview(thread.opBody) : null}
            </div>
            <section className="doc-comments-section">
              <h2 className="doc-comments-heading">
                {thread.commentsCount} {thread.commentsCount === 1 ? "comment" : "comments"}
              </h2>
              <CommentTree comments={comments} threadSlug={thread.slug} />
              <InlineComposer threadId={thread.id} userId={viewerId} />
            </section>
          </article>

          {/* Right: outline rail */}
          <aside className="doc-outline-rail">
            <OutlineList headings={headings} />
            {staveCard && <AttachedStavePanel stave={staveCard} mini />}
          </aside>
        </div>
      </div>
    );
  }

  // ── Forum mode ──────────────────────────────────────────────────────────
  return (
    <div className="container">
      {beacon}
      <div className="thread-page thread-page--forum">
        {/* Left: sidenav */}
        <aside className="thread-sidenav">
          <nav className="thread-sidenav-nav">
            <Link href="/tavern" className="thread-sidenav-link">
              ← Tavern
            </Link>
          </nav>
          <div className="thread-sidenav-meta">
            <div className="thread-sidenav-stat">
              <span className="thread-sidenav-stat-label">VIEWS</span>
              <span className="thread-sidenav-stat-value">{thread.viewsCount}</span>
            </div>
            <div className="thread-sidenav-stat">
              <span className="thread-sidenav-stat-label">VOTES</span>
              <span className="thread-sidenav-stat-value">{thread.voteScore}</span>
            </div>
          </div>
        </aside>

        {/* Center: main content */}
        <main className="thread-main">
          <ThreadBreadcrumb title={thread.title} />
          <h1 className="thread-title">{thread.title}</h1>
          <OpCard thread={thread} isAuthor={isAuthor} />
          <CommentSortBar
            sort={sort}
            count={thread.commentsCount}
            slug={thread.slug}
          />
          <CommentTree comments={comments} threadSlug={thread.slug} />
          <InlineComposer threadId={thread.id} userId={viewerId} />
        </main>

        {/* Right: rail */}
        <aside className="thread-rail">
          {staveCard && <AttachedStavePanel stave={staveCard} />}
          <RelatedPanel threads={related} />
        </aside>
      </div>
    </div>
  );
}
