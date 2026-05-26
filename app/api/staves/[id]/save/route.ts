import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { savedStaves } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isValidStaveId } from "@/lib/staves";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isValidStaveId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  await db
    .insert(savedStaves)
    .values({ userId: user.id, staveId: id })
    .onConflictDoNothing();

  return NextResponse.json({ saved: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isValidStaveId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  await db
    .delete(savedStaves)
    .where(and(eq(savedStaves.userId, user.id), eq(savedStaves.staveId, id)));

  return NextResponse.json({ saved: false });
}
