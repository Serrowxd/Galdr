import { and, eq, ilike, isNull } from "drizzle-orm";

import { getDbOptional } from "@/db";
import { staves, userProfiles } from "@/db/schema";
import { clientIp, enforceRateLimit } from "@/lib/rateLimitGuard";

export async function GET(req: Request) {
  // Prefix queries can enumerate usernames/slugs — throttle per IP.
  const limited = enforceRateLimit(`mentions:${clientIp(req)}`, 30, 60_000);
  if (limited) return limited;

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return Response.json({ staves: [], scribes: [] });

  const db = getDbOptional();
  if (!db) return Response.json({ staves: [], scribes: [] });

  const [staveResults, scribeResults] = await Promise.all([
    db
      .select({ slug: staves.slug })
      .from(staves)
      .where(
        and(
          ilike(staves.slug, `${q}%`),
          isNull(staves.deletedAt),
          eq(staves.status, "published"),
        ),
      )
      .limit(5),
    db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .where(ilike(userProfiles.username, `${q}%`))
      .limit(5),
  ]);

  return Response.json({ staves: staveResults, scribes: scribeResults });
}
