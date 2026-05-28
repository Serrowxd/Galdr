import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import {
  getStaveAttribution,
  getStaveById,
  softDeleteStave,
  updateStave,
} from "@/lib/staves";
import { validateStaveFields } from "@/lib/staveValidation";
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

  return NextResponse.json({ ...stave, forkAttribution });
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

  const update = await updateStave(db, id, {
    title: result.value.title,
    body: result.value.body,
    description: result.value.description,
    tags: result.value.tags,
    license: result.value.license,
  });
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
