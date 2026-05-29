import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { grimoireEntries } from "@/db/schema";
import { getGrimoireById, removeEntry, updateEntry } from "@/lib/grimoires";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createClient } from "@/lib/supabase/server";
import { isUuid, getStaveById } from "@/lib/staves";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

const MAX_ANNOTATION = 1000;
const RATE = 60;
const RATE_WINDOW_MS = 60_000;

/** Loads the entry, asserts it belongs to a draft grimoire owned by the user. */
async function authorize(
  id: string,
  entryId: string,
): Promise<
  | { ok: true; db: NonNullable<ReturnType<typeof getDbOptional>>; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = getDbOptional();
  if (!db) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Database unavailable" }, { status: 503 }),
    };
  }

  if (!isUuid(entryId)) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (grimoire.authorId !== user.id) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (grimoire.status === "published") {
    return { ok: false, response: NextResponse.json({ error: "published" }, { status: 409 }) };
  }

  // Scope the entry to THIS grimoire — owning one grimoire must not grant access
  // to another grimoire's entries (cross-grimoire IDOR).
  const [entry] = await db
    .select({ id: grimoireEntries.id })
    .from(grimoireEntries)
    .where(and(eq(grimoireEntries.id, entryId), eq(grimoireEntries.grimoireId, id)))
    .limit(1);
  if (!entry) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  return { ok: true, db, userId: user.id };
}

export async function PATCH(request: Request, context: Ctx) {
  const { id, entryId } = await context.params;

  const auth = await authorize(id, entryId);
  if (!auth.ok) return auth.response;
  const { db, userId } = auth;

  const limited = enforceRateLimit(`grimoire-entry-patch:${userId}`, RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: {
    pinnedStaveId?: string | null;
    isOptional?: boolean;
    annotation?: string | null;
  } = {};

  if ("is_optional" in payload) patch.isOptional = payload.is_optional === true;
  if ("annotation" in payload) {
    if (
      payload.annotation != null &&
      (typeof payload.annotation !== "string" ||
        payload.annotation.length > MAX_ANNOTATION)
    ) {
      return NextResponse.json(
        { error: `annotation must be a string <= ${MAX_ANNOTATION} chars` },
        { status: 400 },
      );
    }
    patch.annotation = (payload.annotation as string | null) ?? null;
  }
  if ("pinned_stave_id" in payload) {
    // Need the entry's family to validate a pin belongs to it.
    const [entry] = await db
      .select({ staveFamilyId: grimoireEntries.staveFamilyId })
      .from(grimoireEntries)
      .where(and(eq(grimoireEntries.id, entryId), eq(grimoireEntries.grimoireId, id)))
      .limit(1);
    const pinId = payload.pinned_stave_id;
    if (pinId == null) {
      patch.pinnedStaveId = null;
    } else if (typeof pinId === "string") {
      const stave = await getStaveById(db, pinId);
      if (!stave || !entry || stave.familyId !== entry.staveFamilyId) {
        return NextResponse.json({ error: "invalid_pin" }, { status: 422 });
      }
      patch.pinnedStaveId = pinId;
    } else {
      return NextResponse.json({ error: "invalid pinned_stave_id" }, { status: 400 });
    }
  }

  await updateEntry(db, id, entryId, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id, entryId } = await context.params;

  const auth = await authorize(id, entryId);
  if (!auth.ok) return auth.response;

  await removeEntry(auth.db, id, entryId);
  return NextResponse.json({ ok: true });
}
