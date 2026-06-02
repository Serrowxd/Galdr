import { unzipSync, strFromU8, type UnzipFileInfo } from "fflate";
import { parse as parseYaml } from "yaml";

import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  checkPath,
  hasAllowedExtension,
} from "@/lib/packageFileRules";
import { ALLOWED_LICENSES, type License } from "@/lib/staveValidation";

export { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES };
export const MAX_UPLOAD_BYTES = 10_485_760; // 10 MB raw upload

const MANIFEST_YAML = "stave.yaml";
const MANIFEST_JSON = "stave.json";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 32;

export type UploadErrorCode =
  | "missing_content_length"
  | "too_large"
  | "not_a_zip"
  | "too_many_files"
  | "file_too_large"
  | "unpacked_too_large"
  | "invalid_entry_type"
  | "invalid_path"
  | "disallowed_file_type"
  | "missing_manifest"
  | "duplicate_manifest"
  | "invalid_manifest"
  | "manifest_validation_failed"
  | "invalid_license"
  | "entrypoint_not_found"
  | "no_body_candidate"
  | "unauthorized"
  | "db_error";

/** HTTP status for each structured error code (spec 05 error table). */
export const ERROR_STATUS: Record<UploadErrorCode, number> = {
  missing_content_length: 411,
  too_large: 413,
  not_a_zip: 415,
  too_many_files: 400,
  file_too_large: 400,
  unpacked_too_large: 400,
  invalid_entry_type: 400,
  invalid_path: 400,
  disallowed_file_type: 400,
  missing_manifest: 400,
  duplicate_manifest: 400,
  invalid_manifest: 400,
  manifest_validation_failed: 400,
  invalid_license: 400,
  entrypoint_not_found: 400,
  no_body_candidate: 400,
  unauthorized: 401,
  db_error: 500,
};

export type ParsedStave = {
  title: string;
  description: string | null;
  tags: string[];
  license: License;
  body: string;
  /** All package files except the one used as `body`. */
  files: { path: string; content: string }[];
};

export type UploadFailure = {
  ok: false;
  error: UploadErrorCode;
  details?: Record<string, unknown>;
};

export type UploadResult = { ok: true; value: ParsedStave } | UploadFailure;

class UploadValidationError extends Error {
  constructor(
    public code: UploadErrorCode,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

/** Rejects traversal, absolute, null-byte, backslash, and un-normalized paths. */
function assertSafePath(name: string): void {
  const problem = checkPath(name);
  if (problem) {
    throw new UploadValidationError("invalid_path", { path: name, reason: problem });
  }
}

type ManifestShape = {
  title: string;
  description: string | null;
  tags: string[];
  license: License;
  entrypoint?: string;
};

function validateManifest(
  raw: unknown,
  fileExists: (path: string) => boolean,
):
  | { ok: true; value: ManifestShape }
  | { ok: false; error: UploadErrorCode; details?: Record<string, unknown> } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "manifest_validation_failed", details: { fields: ["(root)"] } };
  }
  const m = raw as Record<string, unknown>;
  const fields: string[] = [];

  if (typeof m.title !== "string" || !m.title.trim() || m.title.length > MAX_TITLE) {
    fields.push("title");
  }

  let description: string | null = null;
  if (m.description != null) {
    if (typeof m.description !== "string" || m.description.length > MAX_DESCRIPTION) {
      fields.push("description");
    } else {
      description = m.description;
    }
  }

  let tags: string[] = [];
  if (m.tags != null) {
    if (
      !Array.isArray(m.tags) ||
      !m.tags.every((t) => typeof t === "string") ||
      m.tags.length > MAX_TAGS ||
      (m.tags as string[]).some((t) => t.length > MAX_TAG_LEN)
    ) {
      fields.push("tags");
    } else {
      tags = m.tags as string[];
    }
  }

  if (fields.length > 0) {
    return { ok: false, error: "manifest_validation_failed", details: { fields } };
  }

  let license: License = "CC BY 4.0";
  if (m.license != null) {
    if (!ALLOWED_LICENSES.includes(m.license as License)) {
      return { ok: false, error: "invalid_license", details: { license: m.license } };
    }
    license = m.license as License;
  }

  let entrypoint: string | undefined;
  if (m.entrypoint != null) {
    if (typeof m.entrypoint !== "string") {
      return { ok: false, error: "manifest_validation_failed", details: { fields: ["entrypoint"] } };
    }
    if (!fileExists(m.entrypoint)) {
      return { ok: false, error: "entrypoint_not_found", details: { entrypoint: m.entrypoint } };
    }
    entrypoint = m.entrypoint;
  }

  return {
    ok: true,
    value: { title: (m.title as string).trim(), description, tags, license, entrypoint },
  };
}

/** entrypoint → README.md → alphabetically-first root-level .md → none. */
function resolveBodyPath(
  paths: string[],
  entrypoint: string | undefined,
): string | null {
  if (entrypoint && paths.includes(entrypoint)) return entrypoint;
  if (paths.includes("README.md")) return "README.md";
  const rootMd = paths
    .filter((p) => !p.includes("/") && p.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));
  return rootMd[0] ?? null;
}

/** Derive a human-readable title from the zip filename or package contents. */
function deriveTitleFromFiles(paths: string[], zipName?: string): string {
  if (zipName) {
    const base = zipName
      .replace(/\.zip$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (base) return base.charAt(0).toUpperCase() + base.slice(1);
  }
  const rootMd = paths
    .filter((p) => !p.includes("/") && p.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));
  if (rootMd[0]) {
    const base = rootMd[0]
      .replace(/\.md$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (base && base.toLowerCase() !== "readme") {
      return base.charAt(0).toUpperCase() + base.slice(1);
    }
  }
  return "Untitled Stave";
}

/** Build a minimal stave.yaml with just the required title field. */
function generateManifest(title: string): string {
  const safe = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `title: "${safe}"\n`;
}

/**
 * Validate and parse a stave zip entirely in memory. Caps are enforced in the
 * unzip filter against the central-directory `originalSize` BEFORE decompression,
 * so a declared oversize entry is rejected without ever being inflated (zip-bomb
 * guard); actual decompressed sizes are re-checked afterward as a backstop.
 *
 * Note: symlink detection isn't possible via fflate's high-level API, but since
 * nothing is ever written to disk (file contents are stored as DB text), a symlink
 * entry is just text subject to the same extension allowlist and path checks.
 */
export function parseStaveZip(data: Uint8Array, options?: { fileName?: string }): UploadResult {
  let raw: Record<string, Uint8Array>;
  try {
    let count = 0;
    let total = 0;
    raw = unzipSync(data, {
      filter: (file: UnzipFileInfo) => {
        const name = file.name;
        // Directory markers carry no content — skip them, but a "dir" with bytes
        // is a malformed/abusive entry.
        if (name.endsWith("/")) {
          if (file.originalSize > 0) {
            throw new UploadValidationError("invalid_entry_type", { path: name });
          }
          return false;
        }

        assertSafePath(name);

        if (!hasAllowedExtension(name)) {
          throw new UploadValidationError("disallowed_file_type", { path: name });
        }

        count += 1;
        if (count > MAX_FILES) {
          throw new UploadValidationError("too_many_files", { limit: MAX_FILES });
        }
        if (file.originalSize > MAX_FILE_BYTES) {
          throw new UploadValidationError("file_too_large", {
            path: name,
            size: file.originalSize,
            limit: MAX_FILE_BYTES,
          });
        }
        total += file.originalSize;
        if (total > MAX_TOTAL_BYTES) {
          throw new UploadValidationError("unpacked_too_large", {
            size: total,
            limit: MAX_TOTAL_BYTES,
          });
        }
        return true;
      },
    });
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return { ok: false, error: e.code, details: e.details };
    }
    // fflate threw on a malformed/unreadable archive.
    return { ok: false, error: "not_a_zip" };
  }

  // Backstop: re-check actual decompressed sizes against forged header sizes.
  let actualTotal = 0;
  for (const [path, bytes] of Object.entries(raw)) {
    if (bytes.length > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: "file_too_large",
        details: { path, size: bytes.length, limit: MAX_FILE_BYTES },
      };
    }
    actualTotal += bytes.length;
  }
  if (actualTotal > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: "unpacked_too_large",
      details: { size: actualTotal, limit: MAX_TOTAL_BYTES },
    };
  }

  const textFiles = new Map<string, string>();
  for (const [path, bytes] of Object.entries(raw)) {
    textFiles.set(path, strFromU8(bytes));
  }

  const hasYaml = textFiles.has(MANIFEST_YAML);
  const hasJson = textFiles.has(MANIFEST_JSON);
  if (hasYaml && hasJson) return { ok: false, error: "duplicate_manifest" };
  if (!hasYaml && !hasJson) {
    const title = deriveTitleFromFiles([...textFiles.keys()], options?.fileName);
    textFiles.set(MANIFEST_YAML, generateManifest(title));
  }

  const manifestText = textFiles.get(hasYaml ? MANIFEST_YAML : MANIFEST_JSON)!;
  let manifestRaw: unknown;
  try {
    manifestRaw = hasYaml ? parseYaml(manifestText) : JSON.parse(manifestText);
  } catch {
    return { ok: false, error: "invalid_manifest" };
  }

  const manifest = validateManifest(manifestRaw, (p) => textFiles.has(p));
  if (!manifest.ok) {
    return { ok: false, error: manifest.error, details: manifest.details };
  }

  const bodyPath = resolveBodyPath([...textFiles.keys()], manifest.value.entrypoint);
  if (!bodyPath) return { ok: false, error: "no_body_candidate" };

  const body = textFiles.get(bodyPath)!;
  const files = [...textFiles.entries()]
    .filter(([path]) => path !== bodyPath)
    .map(([path, content]) => ({ path, content }));

  return {
    ok: true,
    value: {
      title: manifest.value.title,
      description: manifest.value.description,
      tags: manifest.value.tags,
      license: manifest.value.license,
      body,
      files,
    },
  };
}
