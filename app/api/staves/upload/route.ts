import { NextResponse } from "next/server";

import { getDbOptional } from "@/db";
import { getUserProfileByUserId } from "@/lib/profiles";
import { enforceRateLimit } from "@/lib/rateLimitGuard";
import { createUploadedStave } from "@/lib/staves";
import {
  ERROR_STATUS,
  MAX_UPLOAD_BYTES,
  parseStaveZip,
  type UploadErrorCode,
} from "@/lib/staveUpload";
import { createClient } from "@/lib/supabase/server";

// fflate + Buffer-based size checks need the Node runtime, not edge.
export const runtime = "nodejs";

const UPLOAD_RATE = 10;
const RATE_WINDOW_MS = 60_000;

function fail(error: UploadErrorCode, details?: Record<string, unknown>) {
  return NextResponse.json(
    details ? { error, details } : { error },
    { status: ERROR_STATUS[error] },
  );
}

function looksLikeZip(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.startsWith("application/zip") || type === "application/x-zip-compressed") {
    return true;
  }
  return file.name.toLowerCase().endsWith(".zip");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const limited = enforceRateLimit(`stave-upload:${user.id}`, UPLOAD_RATE, RATE_WINDOW_MS);
  if (limited) return limited;

  // Reject oversize uploads from the header before reading the body.
  const lengthHeader = request.headers.get("content-length");
  if (!lengthHeader) return fail("missing_content_length");
  const contentLength = Number(lengthHeader);
  if (!Number.isFinite(contentLength)) return fail("missing_content_length");
  if (contentLength > MAX_UPLOAD_BYTES) return fail("too_large");

  const db = getDbOptional();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const profile = await getUserProfileByUserId(db, user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Set up your profile (username) before uploading a stave." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("not_a_zip");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail("not_a_zip");
  if (!looksLikeZip(file)) return fail("not_a_zip");
  // Defense in depth: the actual blob size, not just the declared header.
  if (file.size > MAX_UPLOAD_BYTES) return fail("too_large");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseStaveZip(bytes, { fileName: file.name });
  if (!parsed.ok) return fail(parsed.error, parsed.details);

  try {
    const { id } = await createUploadedStave(db, {
      authorId: user.id,
      title: parsed.value.title,
      body: parsed.value.body,
      description: parsed.value.description,
      tags: parsed.value.tags,
      license: parsed.value.license,
      files: parsed.value.files,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return fail("db_error");
  }
}
