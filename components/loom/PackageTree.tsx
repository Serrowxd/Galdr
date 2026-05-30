"use client";

// ---------------------------------------------------------------------------
// FUTURE UPGRADE: react-arborist
// ---------------------------------------------------------------------------
// This is a hand-rolled tree (custom recursion + @dnd-kit for drag/drop). It is
// intentionally lightweight and has no extra dependency, but it does NOT give us
// virtualization, keyboard navigation, inline-rename affordances, or large-tree
// performance. Once packages routinely run to dozens/hundreds of files, migrate
// the *internals* to `react-arborist` (https://github.com/brimdata/react-arborist):
//
//   npm i react-arborist
//
// Migration is contained because the seam is the `PackageTreeProps` contract
// below — the Loom only knows about those callbacks, so a swap is internal:
//   • Keep `PackageTreeProps` as-is (files, extraDirs, selectedPath,
//     entrypointPath, onSelect, onCreate*/onRename/onDelete/onMove/onSetEntrypoint).
//   • Feed arborist a tree built from `buildTree(files, extraDirs)` (lib/packageTree).
//     Arborist wants stable node ids — use the node `path` as the id.
//   • Map arborist's handlers onto ours: onActivate→onSelect, onMove→onMove
//     (its drag/drop replaces the @dnd-kit code here), onRename→onRename,
//     onCreate→onCreateFile/onCreateFolder. Render the row via its `Node` renderer,
//     reusing the existing `.stave-tree-*` / `.loom-tree-*` CSS for visual parity.
//   • Keep the right-click context menu + "Set as entrypoint" / entrypoint-delete
//     guard (entrypointPath) — those are app rules arborist won't provide.
//   • Drop the manual hydration mount-gate (the dnd-kit SSR id workaround); arborist
//     has its own client-only story.
// Until then, this custom tree is the source of truth.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  FilePlus2,
  FolderPlus,
  Lock,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";

import {
  buildTree,
  type StavePackageFile,
  type TreeDir,
  type TreeNode,
} from "@/lib/packageTree";

export type NodeRef = { path: string; isDir: boolean };

type PromptState = {
  mode: "create-file" | "create-folder" | "rename";
  // Target directory for creates ("" = root); for rename, the node being renamed.
  dir?: string;
  node?: NodeRef;
  value: string;
  error: string | null;
};

type MenuState = { node: NodeRef; x: number; y: number };

export type PackageTreeProps = {
  files: StavePackageFile[];
  extraDirs: string[];
  selectedPath: string;
  entrypointPath: string;
  onSelect: (path: string) => void;
  /** All mutators return an error string to reject, or null on success. */
  onCreateFile: (dir: string, name: string) => string | null;
  onCreateFolder: (dir: string, name: string) => string | null;
  onRename: (node: NodeRef, newName: string) => string | null;
  onDelete: (node: NodeRef) => string | null;
  onMove: (node: NodeRef, destDir: string) => string | null;
  onSetEntrypoint: (path: string) => void;
};

function parentDir(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function baseName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

// dnd ids are namespaced so a folder and a file can never collide. Each row is its
// own drop target: a folder drops *into* itself, a file drops into its parent dir,
// and the scroll background drops at the package root.
const dragId = (n: NodeRef) => `${n.isDir ? "dir" : "file"}:${n.path}`;
const folderDrop = (p: string) => `Dir:${p}`;
const fileDrop = (p: string) => `File:${p}`;
const ROOT_DROP = "root";

function destDirFromOver(overId: string): string {
  if (overId.startsWith("Dir:")) return overId.slice(4);
  if (overId.startsWith("File:")) return parentDir(overId.slice(5));
  return ""; // ROOT_DROP or anything else → package root
}

export function PackageTree({
  files,
  extraDirs,
  selectedPath,
  entrypointPath,
  onSelect,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  onSetEntrypoint,
}: PackageTreeProps) {
  const tree = buildTree(files, extraDirs);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // dnd-kit assigns auto-incrementing aria ids that differ between SSR and the
  // client, causing a hydration mismatch. Apply the draggable attributes only
  // after mount so the server and first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR mount gate
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Nested row droppables overlap the root droppable; prefer the innermost row so
  // hovering a folder/file targets it rather than always falling through to root.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args);
    const rows = hits.filter((h) => h.id !== ROOT_DROP);
    return rows.length > 0 ? rows : hits;
  }, []);

  // Dismiss the context menu on any outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (prompt) inputRef.current?.focus();
  }, [prompt]);

  const openContextMenu = (node: NodeRef, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMoveError(null);
    setMenu({ node, x: e.clientX, y: e.clientY });
  };

  // Directory a create-action should target, given the right-clicked node.
  const targetDirFor = (node: NodeRef) =>
    node.isDir ? node.path : parentDir(node.path);

  const startCreate = (mode: "create-file" | "create-folder", dir: string) => {
    setMenu(null);
    setPrompt({ mode, dir, value: "", error: null });
  };

  const startRename = (node: NodeRef) => {
    setMenu(null);
    setPrompt({ mode: "rename", node, value: baseName(node.path), error: null });
  };

  const handleDelete = (node: NodeRef) => {
    setMenu(null);
    if (node.path === entrypointPath) return; // entrypoint is protected
    if (
      node.isDir &&
      !window.confirm(`Delete folder "${node.path}" and everything inside it?`)
    ) {
      return;
    }
    const error = onDelete(node);
    setMoveError(error);
  };

  const submitPrompt = () => {
    if (!prompt) return;
    const value = prompt.value.trim();
    if (!value) {
      setPrompt({ ...prompt, error: "Enter a name." });
      return;
    }
    let error: string | null = null;
    if (prompt.mode === "create-file") {
      error = onCreateFile(prompt.dir ?? "", value);
    } else if (prompt.mode === "create-folder") {
      error = onCreateFolder(prompt.dir ?? "", value);
    } else if (prompt.node) {
      error = onRename(prompt.node, value);
    }
    if (error) {
      setPrompt({ ...prompt, error });
      return;
    }
    setPrompt(null);
  };

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setMoveError(null);
    setDragLabel(baseName(id.slice(id.indexOf(":") + 1)));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragLabel(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const isDir = activeId.startsWith("dir:");
    const path = activeId.slice(activeId.indexOf(":") + 1);
    const destDir = destDirFromOver(String(over.id));
    const node: NodeRef = { path, isDir };
    setMoveError(onMove(node, destDir));
  };

  const promptLabel =
    prompt?.mode === "rename"
      ? `Rename to`
      : prompt?.mode === "create-folder"
        ? `New folder in ${prompt.dir ? `${prompt.dir}/` : "root"}`
        : `New file in ${prompt?.dir ? `${prompt.dir}/` : "root"}`;

  return (
    <div className="loom-tree-panel">
      <div className="loom-tree-toolbar">
        <span className="loom-tree-title">Package</span>
        <div className="loom-tree-actions">
          <button
            type="button"
            className="btn btn-soft btn-sm loom-tree-btn"
            title="New file at root"
            onClick={() => startCreate("create-file", "")}
          >
            <FilePlus2 size={13} /> New file
          </button>
          <button
            type="button"
            className="btn btn-soft btn-sm loom-tree-btn"
            title="New folder at root"
            onClick={() => startCreate("create-folder", "")}
          >
            <FolderPlus size={13} /> New folder
          </button>
        </div>
      </div>

      {prompt ? (
        <div className="loom-tree-prompt">
          <label className="label-tiny">{promptLabel}</label>
          <input
            ref={inputRef}
            className="input"
            value={prompt.value}
            placeholder={prompt.mode === "create-folder" ? "folder-name" : "name.md"}
            onChange={(e) => setPrompt({ ...prompt, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitPrompt();
              } else if (e.key === "Escape") {
                setPrompt(null);
              }
            }}
          />
          {prompt.error ? (
            <p className="loom-tree-error" role="alert">
              {prompt.error}
            </p>
          ) : null}
          <div className="loom-tree-prompt-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPrompt(null)}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-soft btn-sm" onClick={submitPrompt}>
              {prompt.mode === "rename" ? "Rename" : "Create"}
            </button>
          </div>
        </div>
      ) : null}

      {moveError ? (
        <p className="loom-tree-error" role="alert" style={{ padding: "0 12px" }}>
          {moveError}
        </p>
      ) : null}

      <DndContext
        id="loom-package-tree"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragLabel(null)}
      >
        <RootDrop>
          {tree.length === 0 ? (
            <p className="muted" style={{ padding: 12, fontSize: 12.5 }}>
              No files yet. Use the buttons above to start a package.
            </p>
          ) : (
            <ul className="stave-tree-list">
              {tree.map((node) => (
                <TreeRow
                  key={node.path}
                  node={node}
                  selectedPath={selectedPath}
                  entrypointPath={entrypointPath}
                  dndReady={mounted}
                  onSelect={onSelect}
                  onContextMenu={openContextMenu}
                />
              ))}
            </ul>
          )}
        </RootDrop>
        <DragOverlay dropAnimation={null}>
          {dragLabel ? <div className="loom-tree-drag-chip">{dragLabel}</div> : null}
        </DragOverlay>
      </DndContext>

      {menu ? (
        <div
          className="loom-tree-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="loom-tree-menu-item"
            onClick={() => startCreate("create-file", targetDirFor(menu.node))}
          >
            <FilePlus2 size={12} /> New file
          </button>
          <button
            type="button"
            className="loom-tree-menu-item"
            onClick={() => startCreate("create-folder", targetDirFor(menu.node))}
          >
            <FolderPlus size={12} /> New folder
          </button>
          {!menu.node.isDir && menu.node.path !== entrypointPath ? (
            <button
              type="button"
              className="loom-tree-menu-item"
              onClick={() => {
                const path = menu.node.path;
                setMenu(null);
                onSetEntrypoint(path);
              }}
            >
              <Star size={12} /> Set as entrypoint
            </button>
          ) : null}
          <button
            type="button"
            className="loom-tree-menu-item"
            onClick={() => startRename(menu.node)}
          >
            <Pencil size={12} /> Rename
          </button>
          {menu.node.path === entrypointPath ? (
            <span className="loom-tree-menu-item is-disabled" title="The entrypoint can't be deleted">
              <Lock size={12} /> Entrypoint
            </span>
          ) : (
            <button
              type="button"
              className="loom-tree-menu-item is-danger"
              onClick={() => handleDelete(menu.node)}
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RootDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP });
  return (
    <div
      ref={setNodeRef}
      className={`loom-tree-scroll ${isOver ? "is-root-drop" : ""}`}
    >
      {children}
    </div>
  );
}

type RowProps = {
  node: TreeNode;
  selectedPath: string;
  entrypointPath: string;
  dndReady: boolean;
  onSelect: (path: string) => void;
  onContextMenu: (node: NodeRef, e: React.MouseEvent) => void;
};

function TreeRow({
  node,
  selectedPath,
  entrypointPath,
  dndReady,
  onSelect,
  onContextMenu,
}: RowProps) {
  if (node.kind === "dir") {
    return (
      <DirRow
        node={node}
        selectedPath={selectedPath}
        entrypointPath={entrypointPath}
        dndReady={dndReady}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />
    );
  }

  const ref: NodeRef = { path: node.path, isDir: false };
  return (
    <li>
      <FileLeaf
        nodeRef={ref}
        active={node.path === selectedPath}
        isEntry={node.path === entrypointPath}
        label={node.name}
        dndReady={dndReady}
        onSelect={() => onSelect(node.path)}
        onContextMenu={(e) => onContextMenu(ref, e)}
      />
    </li>
  );
}

function FileLeaf({
  nodeRef,
  active,
  isEntry,
  label,
  dndReady,
  onSelect,
  onContextMenu,
}: {
  nodeRef: NodeRef;
  active: boolean;
  isEntry: boolean;
  label: string;
  dndReady: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef: setDrag, isDragging } = useDraggable({
    id: dragId(nodeRef),
  });
  // Dropping onto a file means "into the folder that holds it".
  const { setNodeRef: setDrop, isOver } = useDroppable({ id: fileDrop(nodeRef.path) });
  const setRefs = (el: HTMLButtonElement | null) => {
    setDrag(el);
    setDrop(el);
  };
  return (
    <button
      ref={setRefs}
      type="button"
      className={`stave-tree-row stave-tree-file ${active ? "is-active" : ""} ${
        isDragging ? "is-dragging" : ""
      } ${isOver ? "is-drop-target" : ""}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={isEntry ? "Entrypoint (mirrors the stave body)" : nodeRef.path}
      {...(dndReady ? attributes : {})}
      {...(dndReady ? listeners : {})}
    >
      {label}
      {isEntry ? <span className="loom-tree-badge">entry</span> : null}
    </button>
  );
}

function DirRow({
  node,
  selectedPath,
  entrypointPath,
  dndReady,
  onSelect,
  onContextMenu,
}: {
  node: TreeDir;
  selectedPath: string;
  entrypointPath: string;
  dndReady: boolean;
  onSelect: (path: string) => void;
  onContextMenu: (node: NodeRef, e: React.MouseEvent) => void;
}) {
  const ref: NodeRef = { path: node.path, isDir: true };
  const { setNodeRef: setDrop, isOver } = useDroppable({ id: folderDrop(node.path) });
  const {
    attributes,
    listeners,
    setNodeRef: setDrag,
    isDragging,
  } = useDraggable({ id: dragId(ref) });
  // The folder header row is both the drag handle and its own drop target.
  const setRefs = (el: HTMLDivElement | null) => {
    setDrag(el);
    setDrop(el);
  };

  return (
    <li>
      <div
        ref={setRefs}
        className={`stave-tree-row stave-tree-folder ${isDragging ? "is-dragging" : ""} ${
          isOver ? "is-drop-target" : ""
        }`}
        onContextMenu={(e) => onContextMenu(ref, e)}
        {...(dndReady ? attributes : {})}
        {...(dndReady ? listeners : {})}
      >
        <ChevronDown size={12} aria-hidden />
        <span>{node.name}</span>
      </div>
      <ul className="stave-tree-list">
        {node.nodes.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            entrypointPath={entrypointPath}
            dndReady={dndReady}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ))}
      </ul>
    </li>
  );
}
