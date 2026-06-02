import { NextResponse } from "next/server";

import { clientIp, enforceRateLimit } from "@/lib/rateLimitGuard";
import { getTavernIndexPage, type TavernIndexInput } from "@/lib/threads";
import { createClient } from "@/lib/supabase/server";

const FEED_LIMIT = 20;

function parsedSort(v: string | null): TavernIndexInput["sort"] {
  if (v === "new" || v === "top") return v;
  return "hot";
}

function parsedTime(v: string | null): TavernIndexInput["time"] {
  if (v === "day" || v === "month" || v === "all") return v;
  return "week";
}

function parsedSurface(v: string | null): TavernIndexInput["surface"] {
  if (v === "stave-attached" || v === "standalone" || v === "following") return v;
  return "all";
}

export async function GET(req: Request) {
  // Rate limit: 60 req/min per IP
  const ip = clientIp(req);
  const limited = enforceRateLimit(`tavern-feed:${ip}`, 60, 60_000);
  if (limited) return limited;

  const url = new URL(req.url);
  const sp = url.searchParams;

  const sort = parsedSort(sp.get("sort"));
  const time = parsedTime(sp.get("time"));
  const surface = parsedSurface(sp.get("surface"));
  const category = sp.get("category") || null;
  const tag = sp.get("tag") || null;
  const showEmpty = sp.get("show") === "empty";
  const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);
  const limitParam = Number(sp.get("limit") ?? "0") || FEED_LIMIT;
  const limit = Math.min(limitParam, 50); // cap at 50

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const result = await getTavernIndexPage({
    sort,
    time,
    surface,
    category,
    tag,
    showEmpty,
    offset,
    limit,
    viewerId,
  });

  return NextResponse.json({
    threads: result.threads,
    hasMore: result.hasMore,
  });
}
