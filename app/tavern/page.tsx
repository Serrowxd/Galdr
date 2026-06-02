import { createClient } from "@/lib/supabase/server";
import {
  getFeaturedStaves,
  getTavernIndexPage,
  type TavernIndexInput,
} from "@/lib/threads";
import { TavernIndexLayout } from "@/components/tavern/TavernIndexLayout";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 20;

type SearchParams = Promise<{
  sort?: string;
  time?: string;
  surface?: string;
  category?: string;
  tag?: string;
  show?: string;
  offset?: string;
}>;

function parsedSort(v: string | undefined): TavernIndexInput["sort"] {
  if (v === "new" || v === "top") return v;
  return "hot";
}

function parsedTime(v: string | undefined): TavernIndexInput["time"] {
  if (v === "day" || v === "month" || v === "all") return v;
  return "week";
}

function parsedSurface(
  v: string | undefined,
): TavernIndexInput["surface"] {
  if (
    v === "stave-attached" ||
    v === "standalone" ||
    v === "following"
  )
    return v;
  return "all";
}

export default async function TavernPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const sort = parsedSort(sp.sort);
  const time = parsedTime(sp.time);
  const surface = parsedSurface(sp.surface);
  const category = sp.category ?? null;
  const tag = sp.tag ?? null;
  const showEmpty = sp.show === "empty";
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const viewerId = user?.id ?? null;

  // "following" with no viewer → render empty with CTA
  const effectiveSurface =
    surface === "following" && !viewerId ? "following" : surface;

  const [result, featuredStaves] = await Promise.all([
    effectiveSurface === "following" && !viewerId
      ? Promise.resolve({ threads: [], hasMore: false, pinned: null })
      : getTavernIndexPage({
          sort,
          time,
          surface: effectiveSurface,
          category,
          tag,
          showEmpty,
          offset,
          limit: FEED_LIMIT,
          viewerId,
        }),
    getFeaturedStaves(),
  ]);

  const query = { sort, time, surface, category, tag, showEmpty, offset };

  return (
    <TavernIndexLayout
      threads={result.threads}
      hasMore={result.hasMore}
      pinned={result.pinned}
      featuredStaves={featuredStaves}
      query={query}
      viewerId={viewerId}
    />
  );
}
