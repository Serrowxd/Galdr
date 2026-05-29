import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import {
  getGrimoireById,
  getGrimoireForkCount,
  getVersionsByFamily,
  resolveGrimoireEntries,
  softDeleteGrimoire,
  updateGrimoire,
} from "@/lib/grimoires";
import { validateGrimoireFields } from "@/lib/grimoireValidation";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const RATE = 30;
const RATE_WINDOW_MS = 60_000;

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Drafts are owner-only — a guessed draft uuid is indistinguishable from a miss.
  if (grimoire.status === "draft") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== grimoire.authorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const [entries, versions, forkCount] = await Promise.all([
    resolveGrimoireEntries(db, id),
    getVersionsByFamily(db, grimoire.familyId),
    getGrimoireForkCount(db, grimoire.familyId),
  ]);

  return NextResponse.json({ grimoire, entries, versions, forkCount });
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

  const limited = enforceRateLimit(`grimoire-patch:${user.id}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (grimoire.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (grimoire.status === "published") {
    return NextResponse.json({ error: "published" }, { status: 409 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate against current values so a partial patch still satisfies the caps.
  const merged = {
    title: payload.title ?? grimoire.title,
    short_description:
      payload.short_description !== undefined
        ? payload.short_description
        : grimoire.shortDescription,
    details: payload.details !== undefined ? payload.details : grimoire.details,
    tags: payload.tags ?? grimoire.tags,
    license: payload.license ?? grimoire.license,
  };
  const result = validateGrimoireFields(merged);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await updateGrimoire(db, id, {
    title: result.value.title,
    shortDescription: result.value.shortDescription,
    details: result.value.details,
    tags: result.value.tags,
    license: result.value.license,
  });

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

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (grimoire.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await softDeleteGrimoire(db, id);
  return NextResponse.json({ ok: true });
}
