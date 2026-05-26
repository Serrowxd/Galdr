import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { userProfiles } from "@/db/schema";
import { validateUsernameInput } from "@/lib/clerkUsername";

/**
 * Public username availability check for the sign-up page (no session exists
 * pre-confirmation). Usernames are public scribe identities, so exposing
 * availability is low-sensitivity. Uniqueness is still enforced at claim time.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("u") ?? searchParams.get("username") ?? "";

  const validated = validateUsernameInput(raw);
  if (!validated.ok) {
    return NextResponse.json({ available: false, valid: false, message: validated.message });
  }

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const [conflict] = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(sql`lower(${userProfiles.username}) = lower(${validated.value})`)
      .limit(1);

    return NextResponse.json({ available: !conflict, valid: true });
  } catch (err) {
    console.error("username availability (public) check failed", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
