import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { createGrimoire, listGrimoires } from "@/lib/grimoires";
import { validateGrimoireFields } from "@/lib/grimoireValidation";
import { getUserProfileByUserId } from "@/lib/profiles";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";

const LIMIT = 24;
const CREATE_RATE = 20;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const sortParam = url.searchParams.get("sort");
  const sort = sortParam === "new" ? "new" : "top";
  const statusParam = url.searchParams.get("status");
  const authorId = url.searchParams.get("authorId") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  // status=draft is owner-scoped: requires auth and restricts to the caller's own rows.
  if (statusParam === "draft") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await listGrimoires(db, {
      status: "draft",
      authorId: user.id,
      q,
      tag,
      sort,
      limit: LIMIT,
      offset: (page - 1) * LIMIT,
    });
    return NextResponse.json(result);
  }

  const result = await listGrimoires(db, {
    status: "published",
    authorId,
    q,
    tag,
    sort,
    limit: LIMIT,
    offset: (page - 1) * LIMIT,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(
    `grimoire-create:${user.id}`,
    CREATE_RATE,
    RATE_WINDOW_MS,
  );
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const profile = await getUserProfileByUserId(db, user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Set up your profile (username) before creating a grimoire." },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = validateGrimoireFields(payload as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { id } = await createGrimoire(db, {
    authorId: user.id,
    title: result.value.title,
    shortDescription: result.value.shortDescription,
    details: result.value.details,
    tags: result.value.tags,
    license: result.value.license,
  });

  return NextResponse.json({ id }, { status: 201 });
}
