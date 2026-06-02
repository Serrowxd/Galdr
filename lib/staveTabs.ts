// Tab identity for the stave detail surface (spec 08). Kept in a server-safe
// module so the server page can resolve `?tab=` without importing the client
// component (calling a "use client" export from the server is disallowed).

export type TabId = "readme" | "files" | "discussion" | "versions";

export const STAVE_TABS: readonly TabId[] = [
  "readme",
  "files",
  "discussion",
  "versions",
] as const;

export function isTabId(value: string | undefined): value is TabId {
  return value != null && (STAVE_TABS as readonly string[]).includes(value);
}

/**
 * The tab shown when `/staves/<slug>` is opened with no `?tab=`. README-first
 * when the package ships one (it's the human entry point), otherwise Files.
 * Kept here so the server page fallback and the client's clean-URL logic agree.
 */
export function defaultTabFor(hasReadme: boolean): TabId {
  return hasReadme ? "readme" : "files";
}
