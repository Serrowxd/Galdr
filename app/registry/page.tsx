import {
  RegistrySurface,
  type RegistryFeedItem,
} from "@/app/registry/RegistrySurface";
import { getDbOptional } from "@/db";
import { listGrimoires } from "@/lib/grimoires";
import { getTopScribes, getTrendingTags, listStaves } from "@/lib/staves";

export const dynamic = "force-dynamic";

const LIMIT = 24;

type FeedItem =
  | { kind: "stave"; id: string; publishedAt: number; monthlyScore: number; data: import("@/lib/staves").StaveWithMetrics }
  | { kind: "grimoire"; id: string; publishedAt: number; monthlyScore: number; data: import("@/lib/grimoires").GrimoireWithMetrics };

type SearchParams = Promise<{
  q?: string;
  tag?: string;
  sort?: string;
  type?: string;
  page?: string;
}>;

export default async function RegistryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const db = getDbOptional();

  if (!db) {
    return (
      <div className="container" style={{ padding: "48px 0" }}>
        <p className="muted">The registry is unavailable right now.</p>
      </div>
    );
  }

  const q = sp.q?.trim() || undefined;
  const tag = sp.tag && sp.tag !== "all" ? sp.tag : undefined;
  const sort = sp.sort === "new" ? "new" : "top";
  const type = sp.type === "stave" || sp.type === "grimoire" ? sp.type : "all";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const offset = (page - 1) * LIMIT;

  const wantStaves = type !== "grimoire";
  const wantGrimoires = type !== "stave";

  // Both pools are queried so every tab can show an accurate count; the feed itself
  // is filtered by `type`. For the merged "all" view we merge-sort client-side and
  // report an approximate combined total (spec 07 #10 caveat).
  const [staveResult, grimoireResult, trendingTags, topScribes] = await Promise.all([
    listStaves(db, { status: "published", q, tag, sort, limit: LIMIT, offset }),
    listGrimoires(db, { status: "published", q, tag, sort, limit: LIMIT, offset }),
    getTrendingTags(db),
    getTopScribes(db),
  ]);

  const items: FeedItem[] = [
    ...(wantStaves ? staveResult.rows : []).map((s) => ({
      kind: "stave" as const,
      id: s.id,
      publishedAt: s.publishedAt ? new Date(s.publishedAt).getTime() : 0,
      monthlyScore: s.monthlyScore,
      data: s,
    })),
    ...(wantGrimoires ? grimoireResult.rows : []).map((g) => ({
      kind: "grimoire" as const,
      id: g.id,
      publishedAt: g.publishedAt ? new Date(g.publishedAt).getTime() : 0,
      monthlyScore: g.monthlyScore,
      data: g,
    })),
  ];

  items.sort((a, b) =>
    sort === "new"
      ? b.publishedAt - a.publishedAt
      : b.monthlyScore - a.monthlyScore || b.publishedAt - a.publishedAt,
  );
  const feed = type === "all" ? items.slice(0, LIMIT) : items;

  const feedItems: RegistryFeedItem[] = feed.map((item) => {
    const tags = item.data.tags ?? [];
    return {
      kind: item.kind,
      id: item.id,
      slug: item.data.slug,
      title: item.data.title,
      description:
        item.kind === "stave"
          ? item.data.description
          : item.data.shortDescription,
      tags,
      version: item.data.version,
      staveCount: item.kind === "grimoire" ? item.data.staveCount : 0,
      authorUsername: item.data.authorUsername,
      savesCount: item.data.savesCount,
      downloadsCount: item.data.downloadsCount ?? 0,
      upvotes: item.data.upvotes,
      downvotes: item.data.downvotes,
      isOrchestration: tags.includes("orchestration"),
    };
  });

  const staveTotal = staveResult.total;
  const grimoireTotal = grimoireResult.total;
  const allTotal = staveTotal + grimoireTotal;
  const total =
    type === "stave" ? staveTotal : type === "grimoire" ? grimoireTotal : allTotal;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (sort !== "top") params.set("sort", sort);
    if (type !== "all") params.set("type", type);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/registry?${qs}` : "/registry";
  };

  return (
    <>
      <div className="reg-page">
        <RegistrySurface
          items={feedItems}
          tags={trendingTags}
          topScribes={topScribes}
          counts={{ all: allTotal, stave: staveTotal, grimoire: grimoireTotal }}
          total={total}
          page={page}
          totalPages={totalPages}
          startRank={offset + 1}
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={page < totalPages ? pageHref(page + 1) : null}
        />
      </div>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
        </div>
      </footer>
    </>
  );
}
