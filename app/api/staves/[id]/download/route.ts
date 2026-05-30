import { Zip, ZipDeflate, strToU8 } from "fflate";
import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { isSafePath } from "@/lib/packageFileRules";
import { getUserProfileByUserId } from "@/lib/profiles";
import { clientIp, enforceRateLimit } from "@/lib/rateLimitGuard";
import { getStaveById, recordStaveDownload } from "@/lib/staves";
import { getStaveFiles } from "@/lib/stavePackages";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Per-package cap mirrors the grimoire route — files are streamed, not buffered,
// but we still refuse pathological packages so one download can't tie up a worker.
const MAX_PACKAGE_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_RATE = 30;
const RATE_WINDOW_MS = 60_000;

/** Collapses an arbitrary label into one safe path segment for a folder/file name. */
function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const stave = await getStaveById(db, id);
  if (!stave) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Published staves are public; drafts and private (unlisted) staves are owner-only.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  if (stave.status !== "published" || stave.private) {
    if (!user || user.id !== stave.authorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Throttle abuse: signed-in users key by id, anonymous by best-effort IP.
  const limited = enforceRateLimit(
    `stave-download:${userId ?? clientIp(request)}`,
    DOWNLOAD_RATE,
    RATE_WINDOW_MS,
  );
  if (limited) return limited;

  // Fall back to a synthetic entrypoint for staves authored before the explorer
  // (body present, no file rows) so they still download as a single file.
  let files = await getStaveFiles(db, stave.id);
  if (files.length === 0) {
    files = [{ path: "stave.md", content: stave.body }];
  }

  // Defense-in-depth: paths are validated on write, but re-check here so a bad row
  // (future code path, manual insert) can never become a zip-slip on extraction.
  files = files.filter((f) => isSafePath(f.path));
  if (files.length === 0) {
    return NextResponse.json({ error: "no_safe_files" }, { status: 422 });
  }

  const totalBytes = files.reduce(
    (sum, f) => sum + Buffer.byteLength(f.content, "utf8"),
    0,
  );
  if (totalBytes > MAX_PACKAGE_BYTES) {
    return NextResponse.json(
      { error: "package_too_large", limit: MAX_PACKAGE_BYTES },
      { status: 413 },
    );
  }

  // Record the download before streaming begins (best-effort, counts the attempt).
  await recordStaveDownload(db, stave.id, userId);

  // Single file → hand back the raw markdown, named after the file itself.
  if (files.length === 1) {
    const only = files[0];
    const filename = sanitizeSegment(
      only.path.split("/").pop() ?? "stave.md",
      "stave.md",
    );
    return new Response(only.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // Multiple files → zip everything under a single parent folder. The folder name
  // comes from ?folder=, falling back to the creator's username, then the slug.
  const url = new URL(request.url);
  const folderParam = url.searchParams.get("folder")?.trim();
  const author = await getUserProfileByUserId(db, stave.authorId);
  const root = sanitizeSegment(folderParam || author?.username || stave.slug, stave.slug);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      try {
        for (const f of files) {
          const entry = new ZipDeflate(`${root}/${f.path}`, { level: 6 });
          zip.add(entry);
          entry.push(strToU8(f.content), true);
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
      "Content-Disposition": `attachment; filename="${root}.zip"`,
    },
  });
}
