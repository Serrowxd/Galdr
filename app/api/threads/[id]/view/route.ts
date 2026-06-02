import { eq, sql } from "drizzle-orm";

import { getDbOptional } from "@/db";
import { threads } from "@/db/schema";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = getDbOptional();
  if (!db) return new Response("ok");
  await db
    .update(threads)
    .set({ viewsCount: sql`${threads.viewsCount} + 1` })
    .where(eq(threads.id, id))
    .catch(() => {});
  return new Response("ok");
}
