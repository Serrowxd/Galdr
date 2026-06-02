"use client";

import { useEffect, useRef, useState } from "react";

import type { ThreadFeedRow } from "@/lib/threads";
import { ThreadFeedRowComponent } from "./ThreadFeedRow";

type Query = {
  sort: string;
  time: string;
  surface: string;
  category: string | null;
  tag: string | null;
  showEmpty: boolean;
  offset: number;
};

type FeedListProps = {
  initial: ThreadFeedRow[];
  hasMore: boolean;
  pinned: ThreadFeedRow | null;
  query: Query;
};

const PAGE_LIMIT = 20;

export function FeedList({ initial, hasMore: initialHasMore, pinned, query }: FeedListProps) {
  const [rows, setRows] = useState<ThreadFeedRow[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef(query.offset + initial.length);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when initial props change (filter navigation)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initial);
    setHasMore(initialHasMore);
    offsetRef.current = query.offset + initial.length;
  }, [initial, initialHasMore, query.offset]);

  async function loadMore() {
    if (loading) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (query.sort !== "hot") params.set("sort", query.sort);
      if (query.time !== "week") params.set("time", query.time);
      if (query.surface !== "all") params.set("surface", query.surface);
      if (query.category) params.set("category", query.category);
      if (query.tag) params.set("tag", query.tag);
      if (query.showEmpty) params.set("show", "empty");
      params.set("offset", String(offsetRef.current));
      params.set("limit", String(PAGE_LIMIT));

      const res = await fetch(`/api/tavern/feed?${params.toString()}`);
      if (!res.ok) return;

      const data = (await res.json()) as {
        threads: ThreadFeedRow[];
        hasMore: boolean;
      };

      setRows((prev) => [...prev, ...data.threads]);
      setHasMore(data.hasMore);
      offsetRef.current += data.threads.length;

      try {
        const url = new URL(window.location.href);
        url.searchParams.set("offset", String(offsetRef.current));
        history.replaceState(null, "", url.toString());
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loading || !hasMore) return;
        void loadMore();
      },
      { rootMargin: "600px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading]);

  if (rows.length === 0 && !pinned) {
    return (
      <div className="empty-state" style={{ marginTop: 24 }}>
        <h2>No threads yet</h2>
        <p>Be the first to start a conversation in the Tavern.</p>
      </div>
    );
  }

  return (
    <div className="tavern-thread-list">
      {pinned && (
        <div className="tavern-pinned-strip">
          <span className="tavern-pinned-label">Pinned</span>
          <ThreadFeedRowComponent row={pinned} />
        </div>
      )}

      {rows.map((row) => (
        <ThreadFeedRowComponent key={row.id} row={row} />
      ))}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />

      {loading && (
        <div className="tavern-feed-loading">
          <span className="tavern-skel-block" style={{ width: "100%", height: 60 }} />
          <span className="tavern-skel-block" style={{ width: "100%", height: 60 }} />
        </div>
      )}

      {!hasMore && rows.length > 0 && (
        <p className="tavern-feed-end">
          You&apos;ve reached the end of the feed.
        </p>
      )}
    </div>
  );
}
