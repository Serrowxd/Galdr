// Shared builder that turns a flat list of package files (path + content) into a
// nested folder/file tree. Folders are implicit — derived from `/`-segmented paths.
// Used by the read-only detail-page inspector and the interactive Loom explorer.

export type StavePackageFile = { path: string; content: string };

export type TreeDir = { kind: "dir"; name: string; path: string; nodes: TreeNode[] };
export type TreeFile = { kind: "file"; name: string; path: string };
export type TreeNode = TreeDir | TreeFile;

/**
 * Builds a sorted tree (dirs first, then files; each alphabetical) from `files`.
 *
 * `extraDirs` lets callers surface folders that hold no files yet — the Loom uses
 * this so a freshly-created (still empty) folder renders before any file lands in
 * it. Empty folders are session-only and never persist on their own.
 */
export function buildTree(
  files: StavePackageFile[],
  extraDirs: string[] = [],
): TreeNode[] {
  type MDir = { kind: "dir"; name: string; path: string; nodes: MNode[] };
  type MFile = { kind: "file"; name: string; path: string };
  type MNode = MDir | MFile;

  const root: MDir = { kind: "dir", name: "", path: "", nodes: [] };

  // Walks/creates the directory chain for `segments`, returning the deepest dir.
  const ensureDir = (segments: string[]): MDir => {
    let cursor = root;
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      let next = cursor.nodes.find(
        (n): n is MDir => n.kind === "dir" && n.name === segment,
      );
      if (!next) {
        next = { kind: "dir", name: segment, path: prefix, nodes: [] };
        cursor.nodes.push(next);
      }
      cursor = next;
    }
    return cursor;
  };

  // Seed empty folders first so they exist even with no children.
  for (const dir of extraDirs) {
    const segments = dir.split("/").filter(Boolean);
    if (segments.length) ensureDir(segments);
  }

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const parts = file.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts[parts.length - 1];
    const parent = ensureDir(parts.slice(0, -1));
    parent.nodes.push({ kind: "file", name, path: file.path });
  }

  const sortNodes = (nodes: MNode[]): TreeNode[] => {
    const dirs = nodes.filter((n): n is MDir => n.kind === "dir");
    const leafs = nodes.filter((n): n is MFile => n.kind === "file");
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    leafs.sort((a, b) => a.name.localeCompare(b.name));
    return [
      ...dirs.map((d) => ({
        kind: "dir" as const,
        name: d.name,
        path: d.path,
        nodes: sortNodes(d.nodes),
      })),
      ...leafs,
    ];
  };

  return sortNodes(root.nodes);
}
