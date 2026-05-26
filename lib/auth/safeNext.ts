/**
 * Sanitize a post-auth redirect target. Only same-origin absolute paths are
 * allowed; anything that could navigate off-site (protocol-relative `//host`,
 * absolute URLs, `javascript:`, backslash tricks) collapses to `/`.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  // Must be a single-slash-rooted path. Reject `//`, `/\`, and any scheme.
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.includes("\\")) return "/";
  // Reject ASCII control characters (codes < 0x20 or 0x7F).
  for (let i = 0; i < next.length; i++) {
    const code = next.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return "/";
  }
  return next;
}
