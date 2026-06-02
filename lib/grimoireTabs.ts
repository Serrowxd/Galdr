// Tab identity for the grimoire detail surface (mirrors lib/staveTabs.ts).
// Kept in a server-safe module so the server page can resolve `?tab=` without
// importing the "use client" detail component (its exports would arrive as
// client-reference proxies and could not be called server-side).
//
// The grimoire's files (README, orchestration, and the immutable STAVES folder
// that holds the vertical stave view) all live inside the "files" tab, exactly
// as a stave's package contents live in its Files tab.

export type GrimoireTabId =
  | "readme"
  | "files"
  | "orchestration"
  | "discussion"
  | "versions";

export const GRIMOIRE_TABS: readonly GrimoireTabId[] = [
  "readme",
  "files",
  "orchestration",
  "discussion",
  "versions",
] as const;

export function isGrimoireTabId(value: string | undefined): value is GrimoireTabId {
  return value != null && (GRIMOIRE_TABS as readonly string[]).includes(value);
}

/**
 * The tab shown when `/grimoires/<slug>` opens with no `?tab=`. README-first
 * when the grimoire ships one (its human entry point), otherwise the Files tab
 * (which opens on the STAVES folder). Kept here so the server fallback and the
 * client URL logic agree.
 */
export function defaultGrimoireTab(hasReadme: boolean): GrimoireTabId {
  return hasReadme ? "readme" : "files";
}
