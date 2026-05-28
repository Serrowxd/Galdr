import { asc, eq } from "drizzle-orm";

import type { GaldrDb } from "@/db";
import { staveFiles } from "@/db/schema";

export type StavePackageFile = { path: string; content: string };

/** Package files for a stave, ordered by path. Empty when the stave has none. */
export async function getStaveFiles(
  db: GaldrDb,
  staveId: string,
): Promise<StavePackageFile[]> {
  return db
    .select({ path: staveFiles.path, content: staveFiles.content })
    .from(staveFiles)
    .where(eq(staveFiles.staveId, staveId))
    .orderBy(asc(staveFiles.path));
}
