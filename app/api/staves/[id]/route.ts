import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import {
  getStaveAttribution,
  getStaveById,
  softDeleteStave,
  updateStave,
} from "@/lib/staves";
import { getStaveFiles } from "@/lib/stavePackages";
import {
  validateEntrypointPath,
  validatePackageFiles,
  validateStaveFields,
} from "@/lib/staveValidation";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const MUTATION_RATE = 30;
const RATE_WINDOW_MS = 60_000;

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const stave = await getStaveById(db, id);
  if (!stave) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Drafts and private (unlisted) staves are owner-only — hide their
  // existence from everyone else.
  if (stave.status === "draft" || stave.private) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id !== stave.authorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Resolve fork attribution so the Loom can show the parent banner on a draft.
  const forkAttribution = stave.forkedFrom
    ? await getStaveAttribution(db, stave.forkedFrom)
    : null;

  // Curated package files so the Loom can hydrate its explorer.
  const files = await getStaveFiles(db, stave.id);

  return NextResponse.json({ ...stave, forkAttribution, files });
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(`stave-patch:${user.id}`, MUTATION_RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const stave = await getStaveById(db, id);
  if (!stave) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (stave.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (stave.status === "published") {
    return NextResponse.json(
      { error: "Published staves are immutable; create a new version" },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Merge over the existing row so partial patches still validate as a whole.
  const merged = { ...stave, ...(payload as Record<string, unknown>) };
  const result = validateStaveFields(merged);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Optional package files. Only touched when the client sends `files`; a plain
  // body-only PATCH leaves the existing package untouched.
  const rawFiles = (payload as { files?: unknown }).files;
  let files: { path: string; content: string }[] | undefined;
  if (rawFiles != null) {
    const filesResult = validatePackageFiles(rawFiles);
    if (!filesResult.ok) {
      return NextResponse.json({ error: filesResult.error }, { status: 400 });
    }
    files = filesResult.value;
  }

  // Entrypoint is validated against the incoming files when both are present.
  const hasEntrypoint = "entrypointPath" in (payload as Record<string, unknown>);
  const entrypoint = validateEntrypointPath(
    (payload as { entrypointPath?: unknown }).entrypointPath,
    files,
  );
  if (!entrypoint.ok) {
    return NextResponse.json({ error: entrypoint.error }, { status: 400 });
  }

  const update = await updateStave(
    db,
    id,
    {
      title: result.value.title,
      body: result.value.body,
      description: result.value.description,
      tags: result.value.tags,
      license: result.value.license,
      // Only touch the column when the client actually sent the field.
      ...(hasEntrypoint ? { entrypointPath: entrypoint.value } : {}),
    },
    files,
  );
  if (!update.ok) {
    if (update.reason === "published") {
      return NextResponse.json(
        { error: "Published staves are immutable" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(`stave-delete:${user.id}`, MUTATION_RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const stave = await getStaveById(db, id);
  if (!stave) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (stave.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await softDeleteStave(db, id);
  return NextResponse.json({ ok: true });
}
