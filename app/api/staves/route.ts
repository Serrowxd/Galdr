import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { getUserProfileByUserId } from "@/lib/profiles";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createStave, listStaves } from "@/lib/staves";
import {
  validateEntrypointPath,
  validatePackageFiles,
  validateStaveFields,
} from "@/lib/staveValidation";
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
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const result = await listStaves(db, {
    status: "published",
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

  const limited = enforceRateLimit(`stave-create:${user.id}`, CREATE_RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  // A stave's author_id FKs to user_profiles; surface the missing-profile case as a
  // clean 400 instead of letting the insert blow up with a foreign-key 500.
  const profile = await getUserProfileByUserId(db, user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Set up your profile (username) before creating a stave." },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = validateStaveFields(payload as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Optional curated package files (Loom explorer). Absent for plain body-only drafts.
  const rawFiles = (payload as { files?: unknown }).files;
  let files: { path: string; content: string }[] | undefined;
  if (rawFiles != null) {
    const filesResult = validatePackageFiles(rawFiles);
    if (!filesResult.ok) {
      return NextResponse.json({ error: filesResult.error }, { status: 400 });
    }
    files = filesResult.value;
  }

  const entrypoint = validateEntrypointPath(
    (payload as { entrypointPath?: unknown }).entrypointPath,
    files,
  );
  if (!entrypoint.ok) {
    return NextResponse.json({ error: entrypoint.error }, { status: 400 });
  }

  const { id } = await createStave(db, {
    authorId: user.id,
    title: result.value.title,
    body: result.value.body,
    description: result.value.description,
    tags: result.value.tags,
    license: result.value.license,
    files,
    entrypointPath: entrypoint.value,
  });

  return NextResponse.json({ id }, { status: 201 });
}
