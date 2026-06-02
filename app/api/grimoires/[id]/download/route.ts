import { inArray, sql } from "drizzle-orm";
import { Zip, ZipDeflate, strToU8 } from "fflate";
import { NextResponse } from "next/server";
import { stringify as stringifyYaml } from "yaml";

import { getDbOptional, type GaldrDb } from "@/db";
import { staveFiles } from "@/db/schema";
import {
  getGrimoireById,
  getStaveFilesFor,
  recordGrimoireDownload,
  resolveGrimoireEntries,
} from "@/lib/grimoires";
import { clientIp, enforceRateLimit } from "@/lib/rateLimitGuard";
import { isSafePath } from "@/lib/packageFileRules";
import { getUserProfileByUserId } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const DOWNLOAD_RATE = 30;
const RATE_WINDOW_MS = 60_000;

// Worst case is 50 entries x 10 MB stave cap = 500 MB. We stream rather than buffer,
// but still refuse pathological packages so a single download can't tie up a worker.
// See memory: galdr-grimoire-download-zip (fflate streaming; archiver = future upgrade).
const MAX_PACKAGE_BYTES = 100 * 1024 * 1024;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

async function packageSizeBytes(db: GaldrDb, staveIds: string[]): Promise<number> {
  if (staveIds.length === 0) return 0;
  const result = await db
    .select({ total: sql<string>`COALESCE(SUM(octet_length(${staveFiles.content})), 0)` })
    .from(staveFiles)
    .where(inArray(staveFiles.staveId, staveIds));
  return Number(result[0]?.total ?? 0);
}

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const grimoire = await getGrimoireById(db, id);
  if (!grimoire) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Published packages are public; draft packages are owner-only.
  let userId: string | null = null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  userId = user?.id ?? null;
  if (grimoire.status !== "published") {
    if (!user || user.id !== grimoire.authorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Throttle abuse: signed-in users key by id, anonymous by best-effort IP.
  const limited = enforceRateLimit(
    `grimoire-download:${userId ?? clientIp(request)}`,
    DOWNLOAD_RATE,
    RATE_WINDOW_MS,
  );
  if (limited) return limited;

  const url = new URL(request.url);
  const excludeParam = url.searchParams.get("exclude");
  const excluded = new Set(
    excludeParam ? excludeParam.split(",").map((s) => s.trim()).filter(Boolean) : [],
  );

  const resolved = await resolveGrimoireEntries(db, id);
  // Required entries can never be excluded; only optional + available entries ship.
  const included = resolved.filter((r) => {
    if (r.resolved.status !== "ok") return false;
    if (r.entry.isOptional && excluded.has(r.entry.id)) return false;
    return true;
  });

  if (included.length === 0) {
    return NextResponse.json({ error: "nothing to package" }, { status: 422 });
  }

  const staveIds = included.map((r) =>
    r.resolved.status === "ok" ? r.resolved.stave.id : "",
  );
  const size = await packageSizeBytes(db, staveIds);
  if (size > MAX_PACKAGE_BYTES) {
    return NextResponse.json(
      { error: "package_too_large", limit: MAX_PACKAGE_BYTES },
      { status: 413 },
    );
  }

  // Record the download before streaming begins (best-effort, counts the attempt).
  await recordGrimoireDownload(db, id, userId);

  const authorProfile = await getUserProfileByUserId(db, grimoire.authorId);

  const root = grimoire.slug;
  const manifest = {
    grimoire: {
      slug: grimoire.slug,
      title: grimoire.title,
      version: grimoire.version,
      license: grimoire.license,
      author: authorProfile?.username ?? null,
      tags: grimoire.tags,
    },
    entries: included.map((r, i) => {
      const stave = r.resolved.status === "ok" ? r.resolved.stave : null;
      return {
        position: i + 1,
        stave_slug: stave?.slug ?? null,
        stave_version: stave?.version ?? null,
        pinned: Boolean(r.entry.pinnedStaveId),
        author: r.resolved.status === "ok" ? r.resolved.author?.username ?? null : null,
        license: stave?.license ?? null,
        optional: r.entry.isOptional,
        annotation: r.entry.annotation,
      };
    }),
  };

  const readme = [
    `# ${grimoire.title}`,
    grimoire.shortDescription ?? "",
    grimoire.details ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      const addText = (path: string, content: string) => {
        const file = new ZipDeflate(path, { level: 6 });
        zip.add(file);
        file.push(strToU8(content), true);
      };

      try {
        addText(`${root}/README.md`, readme);
        addText(`${root}/grimoire.yaml`, stringifyYaml(manifest));

        // Load each stave's files just-in-time so memory tracks one stave at a time.
        for (let i = 0; i < included.length; i++) {
          const r = included[i];
          if (r.resolved.status !== "ok") continue;
          const stave = r.resolved.stave;
          const dir = `${root}/staves/${pad2(i + 1)}-${stave.slug}`;
          // Re-validate paths defensively so a bad row can't become a zip-slip.
          const files = (await getStaveFilesFor(db, stave.id)).filter((f) =>
            isSafePath(f.path),
          );
          if (files.length === 0) {
            // Keep an empty marker so the run-order folder still exists.
            addText(`${dir}/.gitkeep`, "");
          } else {
            for (const f of files) addText(`${dir}/${f.path}`, f.content);
          }
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${grimoire.slug}-v${grimoire.version}.zip"`,
    },
  });
}
