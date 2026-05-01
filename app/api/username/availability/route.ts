import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { validateUsernameInput } from "@/lib/clerkUsername";

/** Max rows to scan via `query`; exact username match applied in code after fetch. */
const USERNAME_LOOKUP_LIMIT = 500;

/**
 * Availability uses `getUserList({ query })` plus exact `username` matching — not the `username`
 * filter array — because Clerk returns "Username is not a valid parameter for this request" when
 * Username isn’t enabled / isn’t accepted for that list filter on some instances.
 *
 * Uniqueness is still judged on the stored `username` field (case-insensitive).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw =
    searchParams.get("u") ?? searchParams.get("username") ?? "";

  const validated = validateUsernameInput(raw);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.message }, { status: 400 });
  }

  const candidate = validated.value;
  const client = await clerkClient();

  let rows;
  try {
    const { data } = await client.users.getUserList({
      query: candidate,
      limit: USERNAME_LOOKUP_LIMIT,
    });
    rows = data.filter(
      (u) =>
        typeof u.username === "string" &&
        u.username.toLowerCase() === candidate.toLowerCase(),
    );
  } catch {
    return NextResponse.json(
      { error: "Could not check username availability." },
      { status: 503 },
    );
  }

  const conflicting = rows.filter((u) => u.id !== userId);

  const available = conflicting.length === 0;
  return NextResponse.json({ available });
}
