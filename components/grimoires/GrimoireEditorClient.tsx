"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pin, Search, Trash2 } from "lucide-react";

import { ALLOWED_LICENSES } from "@/lib/staveValidation";

export type EditorEntry = {
  id: string;
  staveFamilyId: string;
  isOptional: boolean;
  annotation: string | null;
  pinned: boolean;
  staveTitle: string;
  staveSlug: string | null;
  staveVersion: number | null;
  authorUsername: string | null;
};

export type GrimoireEditorProps = {
  id: string;
  initialTitle: string;
  initialShortDescription: string;
  initialDetails: string;
  initialLicense: string;
  initialTags: string[];
  initialEntries: EditorEntry[];
};

const ORCHESTRATION_TAG = "orchestration";
const DEBOUNCE_MS = 250;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 32;

type StaveSearchResult = {
  id: string;
  familyId: string;
  title: string;
  slug: string;
  version: number;
  description: string | null;
};

/** Parse a comma-separated tag string into a normalized, capped list. */
function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .map((t) => t.slice(0, MAX_TAG_LEN)),
    ),
  ].slice(0, MAX_TAGS);
}

function SortableEntry({
  entry,
  position,
  onToggleOptional,
  onAnnotation,
  onRemove,
}: {
  entry: EditorEntry;
  position: number;
  onToggleOptional: (id: string, value: boolean) => void;
  onAnnotation: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="grimoire-editor-entry">
      <button
        type="button"
        className="grimoire-drag-handle"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <span className="grimoire-step" data-optional={entry.isOptional ? "true" : undefined}>
        {position}
      </span>
      <div className="grimoire-editor-entry-body">
        <div className="grimoire-entry-head">
          <span className="grimoire-entry-title">
            {entry.staveTitle}
            {entry.staveVersion != null ? (
              <span className="tag" style={{ marginLeft: 6 }}>
                v{entry.staveVersion}
              </span>
            ) : null}
            {entry.pinned ? (
              <span className="tag" style={{ marginLeft: 6 }}>
                <Pin size={10} aria-hidden /> pinned
              </span>
            ) : null}
            {entry.authorUsername ? (
              <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
                by {entry.authorUsername}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onRemove(entry.id)}
            aria-label="Remove entry"
          >
            <Trash2 size={13} />
          </button>
        </div>
        <label className="label-tiny" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={entry.isOptional}
            onChange={(e) => onToggleOptional(entry.id, e.target.checked)}
          />
          Optional
        </label>
        <input
          className="input"
          placeholder="Annotation (optional) — this stave's role in the workflow"
          defaultValue={entry.annotation ?? ""}
          maxLength={1000}
          onChange={(e) => onAnnotation(entry.id, e.target.value)}
        />
      </div>
    </li>
  );
}

export function GrimoireEditorClient(props: GrimoireEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initialTitle);
  const [shortDescription, setShortDescription] = useState(props.initialShortDescription);
  const [details, setDetails] = useState(props.initialDetails);
  const [license, setLicense] = useState(props.initialLicense);
  const [isOrchestration, setIsOrchestration] = useState(
    props.initialTags.includes(ORCHESTRATION_TAG),
  );
  const [tagsInput, setTagsInput] = useState(
    props.initialTags.filter((t) => t !== ORCHESTRATION_TAG).join(", "),
  );

  const composeTags = (raw: string, orch: boolean) => {
    const base = parseTags(raw).filter((t) => t !== ORCHESTRATION_TAG);
    return orch ? [...base, ORCHESTRATION_TAG] : base;
  };
  const [entries, setEntries] = useState<EditorEntry[]>(props.initialEntries);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaveSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // --- Debounced header save -------------------------------------------------
  const headerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHeader = useCallback(
    (patch: Record<string, unknown>) => {
      setSaveState("saving");
      if (headerTimer.current) clearTimeout(headerTimer.current);
      headerTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/grimoires/${props.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error();
          setSaveState("saved");
        } catch {
          setError("Could not save draft.");
          setSaveState("idle");
        }
      }, DEBOUNCE_MS);
    },
    [props.id],
  );

  // --- Stave search ----------------------------------------------------------
  useEffect(() => {
    const q = query.trim();
    const handle = setTimeout(async () => {
      if (!q) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `/api/staves?status=published&q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { rows: StaveSearchResult[] };
        setResults(data.rows.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const addStave = (stave: StaveSearchResult) => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/grimoires/${props.id}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stave_family_id: stave.familyId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "add failed");
        }
        const { id } = (await res.json()) as { id: string };
        setEntries((prev) => [
          ...prev,
          {
            id,
            staveFamilyId: stave.familyId,
            isOptional: false,
            annotation: null,
            pinned: false,
            staveTitle: stave.title,
            staveSlug: stave.slug,
            staveVersion: stave.version,
            authorUsername: null,
          },
        ]);
        setQuery("");
        setResults([]);
      } catch (e) {
        setError(e instanceof Error ? `Could not add stave (${e.message}).` : "Could not add stave.");
      }
    });
  };

  const removeEntry = (entryId: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/grimoires/${props.id}/entries/${entryId}`, {
        method: "DELETE",
      });
      if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== entryId));
    });
  };

  const toggleOptional = (entryId: string, value: boolean) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, isOptional: value } : e)),
    );
    void fetch(`/api/grimoires/${props.id}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_optional: value }),
    });
  };

  const annotationTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const setAnnotation = (entryId: string, value: string) => {
    const timers = annotationTimers.current;
    const existing = timers.get(entryId);
    if (existing) clearTimeout(existing);
    timers.set(
      entryId,
      setTimeout(() => {
        void fetch(`/api/grimoires/${props.id}/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotation: value || null }),
        });
      }, DEBOUNCE_MS),
    );
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(entries, oldIndex, newIndex);
    setEntries(next);
    void fetch(`/api/grimoires/${props.id}/entries/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positions: next.map((e, i) => ({ entryId: e.id, position: i + 1 })),
      }),
    });
  };

  const publish = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/grimoires/${props.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = (await res.json().catch(() => ({}))) as {
          slug?: string;
          error?: string;
          entryIds?: string[];
        };
        if (!res.ok) {
          if (res.status === 422) {
            setError("Some required staves are unavailable — remove or replace them, or mark them optional.");
          } else {
            setError(data.error ?? "Publish failed.");
          }
          return;
        }
        router.push(`/grimoires/${data.slug}`);
      } catch {
        setError("Could not publish grimoire.");
      }
    });
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="loom-toolbar">
        <input
          className="input loom-title-input"
          value={title}
          placeholder="Grimoire title"
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            saveHeader({ title: e.target.value });
          }}
        />
        <span className="muted" style={{ fontSize: 12 }}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
        </span>
      </div>

      <textarea
        className="textarea"
        rows={2}
        maxLength={500}
        placeholder="Short description (card surface, ≤500 chars)"
        value={shortDescription}
        onChange={(e) => {
          setShortDescription(e.target.value);
          saveHeader({ short_description: e.target.value });
        }}
      />

      <div className="toolbar-row">
        <select
          className="select"
          style={{ maxWidth: 200 }}
          value={license}
          onChange={(e) => {
            setLicense(e.target.value);
            saveHeader({ license: e.target.value });
          }}
          aria-label="License"
        >
          {ALLOWED_LICENSES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={isOrchestration}
            onChange={(e) => {
              setIsOrchestration(e.target.checked);
              saveHeader({ tags: composeTags(tagsInput, e.target.checked) });
            }}
          />
          Orchestration mode (staves can run in parallel)
        </label>
      </div>

      <div className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="label-tiny" htmlFor="grimoire-tags">
          Tags (comma-separated, ≤10)
        </label>
        <input
          id="grimoire-tags"
          className="input"
          placeholder="code-review, security, workflow"
          value={tagsInput}
          onChange={(e) => {
            setTagsInput(e.target.value);
            saveHeader({ tags: composeTags(e.target.value, isOrchestration) });
          }}
        />
      </div>

      <section className="stack-sm">
        <div className="section-head">
          <h2>Staves</h2>
          <span className="muted">{entries.length} / 50</span>
        </div>

        {entries.length === 0 ? (
          <p className="muted">Search below to add staves to this grimoire.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={entries.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="grimoire-editor-list">
                {entries.map((entry, i) => (
                  <SortableEntry
                    key={entry.id}
                    entry={entry}
                    position={i + 1}
                    onToggleOptional={toggleOptional}
                    onAnnotation={setAnnotation}
                    onRemove={removeEntry}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="search-bar" role="search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Search published staves to add…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search staves"
          />
        </div>
        {searching ? <p className="muted" style={{ fontSize: 12 }}>Searching…</p> : null}
        {results.length > 0 ? (
          <ul className="grimoire-search-results">
            {results.map((r) => {
              const already = entries.some((e) => e.staveFamilyId === r.familyId);
              return (
                <li key={r.id} className="grimoire-search-row">
                  <div className="grimoire-search-row-info">
                    <span className="grimoire-search-row-title">
                      {r.title}
                      <span className="tag" style={{ marginLeft: 6 }}>
                        v{r.version}
                      </span>
                    </span>
                    {r.description ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {r.description}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() => addStave(r)}
                    disabled={pending || already}
                  >
                    {already ? "Added" : "+ Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className="stack-sm">
        <div className="section-head">
          <h2>Author notes</h2>
        </div>
        <textarea
          className="textarea"
          rows={8}
          maxLength={20000}
          placeholder="Long-form notes / README (markdown, ≤20000 chars)"
          value={details}
          onChange={(e) => {
            setDetails(e.target.value);
            saveHeader({ details: e.target.value });
          }}
        />
      </section>

      {error ? (
        <p className="stave-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grimoire-publish-bar">
        <span className="muted" style={{ fontSize: 12 }}>
          {saveState === "saving"
            ? "Saving…"
            : "Publishing locks the slug and makes the release immutable."}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => router.push("/library")}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={publish}
            disabled={pending || !title.trim() || entries.length === 0}
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
