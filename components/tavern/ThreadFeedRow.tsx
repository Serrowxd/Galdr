import Link from "next/link";

import type { ThreadFeedRow } from "@/lib/threads";

/** Render an approximate relative time string from a Date or ISO string. */
function timeAgo(date: Date | string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function ThreadFeedRowComponent({ row }: { row: ThreadFeedRow }) {
  return (
    <article className="thread-row">
      {/* Title line */}
      <div className="thread-row-title-line">
        {row.staveAttachment && (
          <a
            href={`/staves/${row.staveAttachment.slug}`}
            className="thread-row-stave-chip"
            onClick={(e) => e.stopPropagation()}
          >
            @{row.staveAttachment.slug}
          </a>
        )}
        <Link href={`/tavern/${row.slug}`} className="thread-row-title">
          {row.title}
        </Link>
      </div>

      {/* Excerpt */}
      {row.opBodyExcerpt && (
        <p className="thread-row-excerpt">{row.opBodyExcerpt}</p>
      )}

      {/* Tags row */}
      <div className="thread-row-tags">
        {row.category && (
          <span className="thread-row-tag thread-row-tag--category">
            {row.category}
          </span>
        )}
        {row.isDocMode && (
          <span className="thread-row-tag thread-row-tag--doc">DOC</span>
        )}
        {row.tags.map((t) => (
          <Link
            key={t}
            href={`/tavern?tag=${encodeURIComponent(t)}`}
            className="thread-row-tag thread-row-tag--plain"
          >
            #{t}
          </Link>
        ))}
      </div>

      {/* Meta row */}
      <div className="thread-row-meta">
        <span>
          by{" "}
          <Link href={`/saga/${row.author.username}`} className="thread-row-author">
            {row.author.username}
          </Link>
        </span>
        <span className="thread-row-meta-sep" aria-hidden>
          ·
        </span>
        <time dateTime={new Date(row.createdAt).toISOString()}>
          {timeAgo(row.createdAt)}
        </time>
        <span className="thread-row-meta-sep" aria-hidden>
          ·
        </span>
        <Link href={`/tavern/${row.slug}`} className="thread-row-comments">
          {row.commentsCount} comment{row.commentsCount !== 1 ? "s" : ""}
        </Link>
        <span className="thread-row-meta-sep" aria-hidden>
          ·
        </span>
        <span className="thread-row-score" title="Vote score">
          {row.voteScore > 0 ? "+" : ""}
          {row.voteScore}
        </span>
      </div>
    </article>
  );
}
