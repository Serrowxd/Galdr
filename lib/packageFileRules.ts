// Single source of truth for stave package-file rules — shared by the zip-upload
// parser (lib/staveUpload.ts), the save-path validator (lib/staveValidation.ts),
// and the Loom client for instant feedback. Dependency-free so it can be imported
// from anywhere without risking an import cycle.

export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 1_048_576; // 1 MB per file (matches stave_files CHECK)
export const MAX_TOTAL_BYTES = 10_485_760; // 10 MB cumulative uncompressed
export const MAX_PATH_LEN = 255; // keeps stave_files.path (unbounded text) sane

export const ALLOWED_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml"] as const;

export function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type PathProblem =
  | "empty"
  | "too_long"
  | "control_char"
  | "absolute"
  | "backslash"
  | "traversal"
  | "dot_segment"
  | "empty_segment";

/**
 * Pure path-safety check (non-throwing). Rejects empty/over-long paths, control
 * characters (incl. null byte), absolute, backslash, traversal, and un-normalized
 * paths. Returns the first problem found, or null when the path is safe.
 */
export function checkPath(name: string): PathProblem | null {
  if (name.length === 0) return "empty";
  if (name.length > MAX_PATH_LEN) return "too_long";
  // Reject all C0 control chars (covers the null byte, newlines, tabs, etc.).
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) < 0x20) return "control_char";
  }
  if (name.startsWith("/")) return "absolute";
  if (name.includes("\\")) return "backslash";
  for (const seg of name.split("/")) {
    if (seg === "..") return "traversal";
    if (seg === ".") return "dot_segment";
    if (seg === "") return "empty_segment"; // leading slash (caught above) or "//"
  }
  return null;
}

export function isSafePath(name: string): boolean {
  return checkPath(name) === null;
}
