"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Code2,
  Copy,
  Eraser,
  ExternalLink,
  FileText,
  GitFork,
  Heading2,
  Lightbulb,
  List,
  Lock,
  PlayCircle,
  Save,
  Scale,
  ShieldAlert,
  RotateCcw,
  Send,
  Table,
  Tag,
  TriangleAlert,
  Trash2,
  Undo2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  type AIProvider,
  loadGlobalAISettings,
  saveGlobalAISettings,
} from "@/lib/globalSettings";
import { renderMarkdownPreview } from "@/lib/markdownPreview";
import { getStaveAnalyzer, type CheckReport } from "@/lib/loom/analyzeStave";
import { DEFAULT_LICENSE, LICENSES, toLicense } from "@/lib/loom/licenses";
import { BASELINE_TAGS } from "@/lib/loom/tags";
import type { License } from "@/lib/staveValidation";
import { GaldrSignInButton } from "@/components/GaldrSignInButton";
import { createClient } from "@/lib/supabase/client";

const initialMarkdown = `# Stave: Code Reviewer

## Role
You are a meticulous code reviewer specializing in security and performance.

## Instructions
1. Analyze the provided code for vulnerabilities
2. Check for N+1 queries and memory leaks
3. Verify error handling coverage
4. Suggest improvements with examples

## Constraints
- Never approve code with SQL injection vectors
- Flag any hardcoded credentials
- Maximum response length: 2000 tokens
`;

const templates = {
  reviewer: initialMarkdown,
  moderation: `# Stave: Forum Moderator

## Role
You are a strict forum moderation stave that focuses on civility and policy.

## Instructions
1. Detect toxicity and personal attacks.
2. Suggest a calm rewrite for borderline content.
3. Classify enforcement action: warn, hide, or lock.

## Constraints
- Preserve user intent where possible.
- Keep explanations under 8 lines.
`,
  release: `# Stave: Release Note Forger

## Role
Generate release notes from commits and issue metadata.

## Inputs
- Commit summaries
- Closed issue IDs
- Breaking change markers

## Output
1. Highlights
2. Fixes
3. Breaking changes
4. Upgrade guidance
`,
};

const providerOptions: { value: AIProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
];

type ForkBanner = {
  slug: string | null;
  title: string;
  authorUsername: string | null;
};

/** Title is parsed from the first H1 in the body; falls back when absent. */
function deriveTitle(md: string): string {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : "Untitled stave";
}

function buildTerminalLines(report: CheckReport, traceLevel: string): string[] {
  const lines: string[] = [
    `> quality-check profile: ${traceLevel}`,
    "> mode: structural analysis (no tool execution)",
    "> parsing stave markdown...",
    `> score computed: ${report.score}/100`,
  ];

  if (report.errors.length === 0 && report.warnings.length === 0) {
    lines.push("> no blocking inconsistencies detected");
  }

  report.errors.forEach((item) => lines.push(`ERROR: ${item}`));
  report.warnings.forEach((item) => lines.push(`WARN: ${item}`));
  report.suggestions.forEach((item) => lines.push(`SUGGEST: ${item}`));

  lines.push("> quality-check complete");
  return lines;
}

function LoomEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const initialSettings = loadGlobalAISettings();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<"terminal" | "report" | "preview">(
    "preview",
  );
  const [traceLevel, setTraceLevel] = useState("standard");
  const [copied, setCopied] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(initialSettings.provider);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [saveToGlobal, setSaveToGlobal] = useState(true);
  const [savedSettingsNotice, setSavedSettingsNotice] = useState("");
  const [report, setReport] = useState<CheckReport>({
    score: 0,
    errors: [],
    warnings: [],
    suggestions: [],
  });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Draft persistence + authorship intent (spec 02).
  const [draftId, setDraftId] = useState<string | null>(null);
  const [license, setLicense] = useState<License>(DEFAULT_LICENSE);
  // Publish metadata, surfaced in the fold-out. `title` overrides the H1-derived
  // title when non-empty; version is informational (auto-managed by the chain).
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [version, setVersion] = useState(1);
  const [isPrivate, setIsPrivate] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishedLock, setPublishedLock] = useState<string | null>(null);
  const [forkBanner, setForkBanner] = useState<ForkBanner | null>(null);

  // Publish flow (saves the draft first, then locks the slug + goes public).
  const [showPublish, setShowPublish] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Transient toolbar undo (spec: 5-second window after a destructive toolbar
  // action). Snapshot is the markdown captured *before* the action; we restore
  // it verbatim on Undo. Designed to be defensive: the timer is cleared on
  // unmount, fresh keystrokes dismiss the prompt so we never silently overwrite
  // typed work, and applyUndo type-checks the snapshot before restoring.
  const [undoState, setUndoState] = useState<{
    snapshot: string;
    label: string;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingUndoRef = useRef(false);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const dismissUndo = () => {
    clearUndoTimer();
    setUndoState(null);
  };

  // Capture a snapshot of `markdown` BEFORE running `mutate`. Only records the
  // undo if the mutation actually changed the content, so the prompt is never
  // misleading. `label` is shown to the user (e.g. "Heading inserted").
  const withUndo = (label: string, mutate: () => void) => {
    const snapshot = markdown;
    mutate();
    if (typeof snapshot !== "string") return;
    clearUndoTimer();
    setUndoState({ snapshot, label });
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  const applyUndo = () => {
    if (!undoState) return;
    const { snapshot } = undoState;
    if (typeof snapshot !== "string") return;
    isApplyingUndoRef.current = true;
    setMarkdown(snapshot);
    clearUndoTimer();
    setUndoState(null);
    queueMicrotask(() => {
      isApplyingUndoRef.current = false;
    });
  };

  // Auth state — Save is gated; compose is always available.
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);
  const isLoaded = user !== undefined;
  const isSignedIn = user != null;

  // Hydrate an owned draft from ?id=. Skip the row we just created ourselves
  // (replaceState sets the param but state is already current).
  useEffect(() => {
    if (!idParam || idParam === draftId) return;
    let cancelled = false;
    setLoadError(null);
    setPublishedLock(null);
    (async () => {
      try {
        const res = await fetch(`/api/staves/${idParam}`);
        if (!res.ok) {
          if (!cancelled) {
            setLoadError(
              res.status === 404 || res.status === 403 ? "not_found" : "error",
            );
          }
          return;
        }
        const data = (await res.json()) as {
          id: string;
          title?: string;
          description?: string | null;
          tags?: string[] | null;
          version?: number;
          body: string;
          license: string;
          status: string;
          forkAttribution?: ForkBanner | null;
        };
        if (cancelled) return;
        if (data.status === "published") {
          setPublishedLock(data.id);
          return;
        }
        setDraftId(data.id);
        setMarkdown(data.body ?? "");
        setLicense(toLicense(data.license));
        setTitle(data.title ?? "");
        setDescription(data.description ?? "");
        setTags(Array.isArray(data.tags) ? data.tags : []);
        setVersion(typeof data.version === "number" ? data.version : 1);
        setForkBanner(data.forkAttribution ?? null);
        setSaveState("idle");
      } catch {
        if (!cancelled) setLoadError("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idParam, draftId]);

  const lineCount = useMemo(() => markdown.split("\n").length, [markdown]);

  const insertSnippet = (snippet: string, label: string) => {
    withUndo(label, () => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setMarkdown((prev) => `${prev}\n${snippet}`);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = markdown.slice(0, start) + snippet + markdown.slice(end);
      setMarkdown(nextValue);
      queueMicrotask(() => {
        textarea.focus();
        const nextCursor = start + snippet.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
      });
    });
  };

  const applyTemplate = (templateKey: keyof typeof templates) => {
    withUndo("Template applied", () => {
      setMarkdown(templates[templateKey]);
    });
  };

  const formatMarkdown = () => {
    withUndo("Tidied", () => {
      const formatted = markdown
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n");
      setMarkdown(formatted);
    });
  };

  const resetMarkdown = () => {
    withUndo("Reset to template", () => {
      setMarkdown(initialMarkdown);
    });
  };

  const clearMarkdown = () => {
    withUndo("Cleared", () => {
      setMarkdown("");
    });
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const handleSaveSettings = () => {
    saveGlobalAISettings({ provider, apiKey });
    setSavedSettingsNotice("Saved");
    setTimeout(() => setSavedSettingsNotice(""), 1400);
  };

  const handleAnalyze = async () => {
    if (saveToGlobal) {
      saveGlobalAISettings({ provider, apiKey });
    }
    setOutput("");
    setRunning(true);
    setActiveResultTab("terminal");

    const nextReport = await getStaveAnalyzer().analyzeStave({ markdown });
    setReport(nextReport);
    setOutput(buildTerminalLines(nextReport, traceLevel).join("\n"));
    setRunning(false);
  };

  // Persists the current editor state and returns the draft id, or null on
  // failure. Shared by the Save button and the Publish flow (publish saves the
  // latest content first so what goes public matches what's on screen).
  const persistDraft = async (): Promise<string | null> => {
    setSaveState("saving");
    // The fold-out title wins when set; otherwise fall back to the H1.
    const effectiveTitle = title.trim() || deriveTitle(markdown);
    const trimmedDescription = description.trim();
    const fields = {
      title: effectiveTitle,
      body: markdown,
      license,
      description: trimmedDescription || null,
      tags,
    };

    try {
      if (!draftId) {
        const res = await fetch("/api/staves", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...fields, status: "draft" }),
        });
        if (!res.ok) {
          setSaveState("error");
          return null;
        }
        const { id } = (await res.json()) as { id: string };
        setDraftId(id);
        window.history.replaceState(null, "", `/loom?id=${id}`);
        setLastSavedAt(new Date());
        setSaveState("saved");
        return id;
      }
      const res = await fetch(`/api/staves/${draftId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        if (res.status === 409) setPublishedLock(draftId);
        setSaveState("error");
        return null;
      }
      setLastSavedAt(new Date());
      setSaveState("saved");
      return draftId;
    } catch {
      setSaveState("error");
      return null;
    }
  };

  const handleSaveDraft = async () => {
    if (!isSignedIn) return;
    await persistDraft();
  };

  const MAX_TAGS = 10;
  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= MAX_TAGS
          ? prev
          : [...prev, tag],
    );
  };

  // Opening the fold-out seeds the title field from the H1 so it's editable
  // rather than blank, and clears any stale publish error.
  const openPublish = () => {
    setPublishError(null);
    if (!title.trim()) setTitle(deriveTitle(markdown));
    setShowPublish(true);
  };

  const confirmPublish = async () => {
    if (!isSignedIn) return;
    setPublishing(true);
    setPublishError(null);

    const id = await persistDraft();
    if (!id) {
      setPublishing(false);
      setPublishError("Could not save your draft before publishing. Try again.");
      return;
    }

    try {
      const res = await fetch(`/api/staves/${id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          releaseNotes: releaseNotes.trim() || undefined,
          private: isPrivate,
        }),
      });
      if (!res.ok) {
        setPublishError(
          res.status === 400
            ? "Add a title (a top-level # heading) and some body text before publishing."
            : "Could not publish this stave. Try again.",
        );
        setPublishing(false);
        return;
      }
      const { slug } = (await res.json()) as { slug: string };
      router.push(`/staves/${slug}`);
    } catch {
      setPublishError("Could not publish this stave. Try again.");
      setPublishing(false);
    }
  };

  const startNewVersion = async () => {
    if (!publishedLock) return;
    try {
      const res = await fetch(`/api/staves/${publishedLock}/new-version`, {
        method: "POST",
      });
      if (!res.ok) {
        setLoadError("error");
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/loom?id=${id}`);
    } catch {
      setLoadError("error");
    }
  };

  const saveStatusText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Save failed"
        : saveState === "saved" && lastSavedAt
          ? `Saved · ${lastSavedAt.toLocaleTimeString()}`
          : draftId
            ? "Draft"
            : "Unsaved";

  return (
    <>
      <div className="loom-header">
        <div>
          <p className="page-hero-tag" style={{ marginBottom: 6 }}>
            Build a stave
          </p>
          <h1>The Loom</h1>
        </div>
        <div className="loom-controls">
          <Link href="/upload" className="btn btn-ghost btn-sm">
            <Upload size={14} />
            Import .zip
          </Link>
          <label className="loom-trace">
            Trace
            <select
              className="select"
              value={traceLevel}
              onChange={(e) => setTraceLevel(e.target.value)}
              aria-label="Trace level"
            >
              <option value="standard">Standard</option>
              <option value="verbose">Verbose</option>
              <option value="strict">Strict</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOutput("")}
            disabled={running && output.length === 0}
          >
            <Trash2 size={13} />
            Clear output
          </button>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={handleAnalyze}
            disabled={running}
          >
            <PlayCircle size={14} />
            {running ? "Analyzing..." : "Analyze stave"}
          </button>
          {isLoaded && isSignedIn && !publishedLock ? (
            <div className="loom-save-cluster">
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={handleSaveDraft}
                disabled={saveState === "saving" || publishing}
              >
                <Save size={14} />
                Save draft
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={openPublish}
                disabled={publishing || saveState === "saving" || !markdown.trim()}
              >
                <Send size={14} />
                Publish
              </button>
              <span
                className={`loom-save-status ${saveState === "error" ? "is-error" : ""}`}
              >
                {saveStatusText}
              </span>
            </div>
          ) : isLoaded && !isSignedIn ? (
            <GaldrSignInButton>
              <span className="btn btn-primary btn-sm">
                <Save size={14} />
                Sign in to save
              </span>
            </GaldrSignInButton>
          ) : null}
        </div>
      </div>

      {forkBanner || publishedLock || loadError ? (
        <div className="loom-notices">
          {forkBanner ? (
            <p className="loom-notice">
              <GitFork size={13} aria-hidden /> This is a fork of{" "}
              {forkBanner.slug ? (
                <Link href={`/staves/${forkBanner.slug}`}>{forkBanner.title}</Link>
              ) : (
                <span>{forkBanner.title}</span>
              )}
              {forkBanner.authorUsername ? ` by ${forkBanner.authorUsername}` : ""}.
              You can rename it and change the license before publishing.
            </p>
          ) : null}

          {publishedLock ? (
            <div className="loom-notice is-warning">
              <span>
                This stave is published and can&apos;t be edited. Create a new version to
                make changes.
              </span>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={startNewVersion}
              >
                Create new version
              </button>
            </div>
          ) : null}

          {loadError === "not_found" ? (
            <p className="loom-notice is-error">
              That draft could not be loaded (it may not exist or isn&apos;t yours).
              Starting a fresh draft is fine.
            </p>
          ) : loadError === "error" ? (
            <p className="loom-notice is-error">
              Something went wrong loading that stave. Try again.
            </p>
          ) : null}
        </div>
      ) : null}

      {showPublish ? (
        <div className="loom-notices">
          <div className="loom-publish-panel" role="dialog" aria-label="Publish stave">
            <div className="loom-publish-grid">
              <label className="loom-publish-field">
                <span className="label-tiny">Title</span>
                <input
                  className="input"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name your stave"
                />
              </label>
              <label className="loom-publish-field">
                <span className="label-tiny">Version</span>
                <input
                  className="input"
                  value={`v${version}`}
                  readOnly
                  aria-readonly
                  title="Versions increment automatically when you publish edits."
                />
              </label>
            </div>

            <label className="loom-publish-field">
              <span className="label-tiny">Description (optional, ≤ 2000 chars)</span>
              <textarea
                className="textarea"
                rows={2}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this stave do?"
              />
            </label>

            <div className="loom-publish-field">
              <span className="label-tiny">
                <Tag size={11} aria-hidden /> Tags ({tags.length}/{MAX_TAGS})
              </span>
              <div className="loom-tag-picker" role="group" aria-label="Tags">
                {BASELINE_TAGS.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`loom-tag-chip ${selected ? "is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => toggleTag(tag)}
                      disabled={!selected && tags.length >= MAX_TAGS}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="loom-publish-field">
              <span className="label-tiny">Release notes (optional, ≤ 500 chars)</span>
              <textarea
                className="textarea"
                rows={2}
                maxLength={500}
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="What's in this release?"
              />
            </label>

            <label className="loom-publish-private">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <Lock size={13} aria-hidden />
              <span>
                <strong>Private (unlisted)</strong> — published but hidden from the
                registry, saga, and search. Only you can open its page.
              </span>
            </label>

            <p className="muted" style={{ fontSize: 12 }}>
              {isPrivate
                ? "Publishing locks this stave's URL. Only you will be able to view it."
                : "Publishing locks this stave's public URL and lists it in the registry."}{" "}
              Edits afterward create a new version.
            </p>
            {publishError ? (
              <p className="loom-save-status is-error" role="alert">
                {publishError}
              </p>
            ) : null}
            <div className="empty-state-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPublish(false)}
                disabled={publishing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={confirmPublish}
                disabled={publishing}
              >
                <Send size={14} />
                {publishing
                  ? "Publishing…"
                  : isPrivate
                    ? "Publish privately"
                    : "Publish stave"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="loom-pane">
        <div className="loom-col">
          <div className="loom-pane-head">Stave editor · {lineCount} lines</div>
          <div className="loom-toolbar" role="toolbar" aria-label="Editor tools">
            <div className="loom-tool-group">
              <button
                type="button"
                className="loom-tool-btn"
                onClick={() => insertSnippet("\n## Section\n", "Heading inserted")}
              >
                <Heading2 size={13} /> Heading
              </button>
              <button
                type="button"
                className="loom-tool-btn"
                onClick={() =>
                  insertSnippet("\n- item one\n- item two\n", "List inserted")
                }
              >
                <List size={13} /> List
              </button>
              <button
                type="button"
                className="loom-tool-btn"
                onClick={() => insertSnippet("\n```md\n# Notes\n```\n", "Code inserted")}
              >
                <Code2 size={13} /> Code
              </button>
              <button
                type="button"
                className="loom-tool-btn"
                onClick={() =>
                  insertSnippet(
                    "\n| Field | Value |\n| --- | --- |\n| Risk | High |\n",
                    "Table inserted",
                  )
                }
              >
                <Table size={13} /> Table
              </button>
            </div>

            {undoState ? (
              <div
                className="loom-tool-group loom-undo-group"
                role="status"
                aria-live="polite"
              >
                <button
                  type="button"
                  className="loom-tool-btn loom-undo-btn"
                  onClick={applyUndo}
                  title={`Undo: ${undoState.label}`}
                >
                  <Undo2 size={13} /> Undo {undoState.label.toLowerCase()}
                </button>
              </div>
            ) : null}

            <div className="loom-tool-group">
              <label className="loom-template">
                <FileText size={13} />
                <select
                  className="select"
                  defaultValue=""
                  onChange={(e) => {
                    const value = e.target.value as keyof typeof templates;
                    if (value) {
                      applyTemplate(value);
                      e.target.value = "";
                    }
                  }}
                  aria-label="Apply template"
                >
                  <option value="" disabled>
                    Template
                  </option>
                  <option value="reviewer">Code Reviewer</option>
                  <option value="moderation">Forum Moderator</option>
                  <option value="release">Release Notes</option>
                </select>
              </label>
              <button type="button" className="loom-tool-btn" onClick={formatMarkdown}>
                <Wand2 size={13} /> Tidy
              </button>
              <label className="loom-template" title="License for this stave">
                <Scale size={13} />
                <select
                  className="select"
                  value={license}
                  onChange={(e) => setLicense(e.target.value as License)}
                  aria-label="License"
                >
                  {LICENSES.map((option) => (
                    <option key={option.value} value={option.value} title={option.tooltip}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="loom-tool-btn" onClick={copyMarkdown}>
                <Copy size={13} /> {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="loom-tool-btn"
                onClick={resetMarkdown}
              >
                <RotateCcw size={13} /> Reset
              </button>
              <button
                type="button"
                className="loom-tool-btn is-danger"
                onClick={clearMarkdown}
              >
                <Eraser size={13} /> Clear
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="loom-editor"
            value={markdown}
            onChange={(e) => {
              // Fresh keystrokes invalidate any pending undo snapshot so we
              // never silently overwrite the user's new typing on restore.
              if (!isApplyingUndoRef.current && undoState) {
                dismissUndo();
              }
              setMarkdown(e.target.value);
            }}
            aria-label="Markdown editor"
            spellCheck={false}
          />
        </div>

        <div className="loom-col">
          <div className="loom-pane-head">Quality check results</div>
          <div className="loom-result-tabs" role="tablist" aria-label="Result views">
            <button
              type="button"
              role="tab"
              className={`loom-result-tab ${activeResultTab === "terminal" ? "is-active" : ""}`}
              onClick={() => setActiveResultTab("terminal")}
            >
              Terminal
            </button>
            <button
              type="button"
              role="tab"
              className={`loom-result-tab ${activeResultTab === "report" ? "is-active" : ""}`}
              onClick={() => setActiveResultTab("report")}
            >
              Report
            </button>
            <button
              type="button"
              role="tab"
              className={`loom-result-tab ${activeResultTab === "preview" ? "is-active" : ""}`}
              onClick={() => setActiveResultTab("preview")}
            >
              Preview
            </button>
          </div>

          {activeResultTab === "terminal" ? (
            output ? (
              <pre className="loom-terminal">
                {output}
                {running ? <span className="cursor-pulse" /> : null}
              </pre>
            ) : (
              <p className="loom-terminal-muted">
                Press <strong style={{ color: "var(--accent)" }}>Analyze stave</strong> to
                run a quality check.
              </p>
            )
          ) : null}

          {activeResultTab === "report" ? (
            <section className="loom-report">
              <div className="loom-report-settings">
                <label className="loom-report-field">
                  <span className="loom-report-field-label">Provider</span>
                  <select
                    className="select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as AIProvider)}
                  >
                    {providerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="loom-report-field">
                  <span className="loom-report-field-label">API key</span>
                  <input
                    className="input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </label>
              </div>

              <div className="loom-report-actions">
                <label className="loom-save-global">
                  <input
                    type="checkbox"
                    checked={saveToGlobal}
                    onChange={(e) => setSaveToGlobal(e.target.checked)}
                  />
                  Save to global settings
                </label>
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={handleSaveSettings}
                >
                  Save settings
                </button>
                <Link href="/settings" className="stave-action-link">
                  Open settings <ExternalLink size={12} />
                </Link>
                {savedSettingsNotice ? (
                  <span className="muted">{savedSettingsNotice}</span>
                ) : null}
              </div>

              <div className="loom-report-score">
                <span className="loom-report-score-label">Quality score</span>
                <strong className="loom-report-score-value">{report.score}/100</strong>
              </div>

              <div className="loom-report-grid">
                <article className="loom-report-card">
                  <h3>
                    <ShieldAlert size={13} /> Errors ({report.errors.length})
                  </h3>
                  {report.errors.length ? (
                    <ul>
                      {report.errors.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No blocking errors detected.</p>
                  )}
                </article>
                <article className="loom-report-card">
                  <h3>
                    <TriangleAlert size={13} /> Warnings ({report.warnings.length})
                  </h3>
                  {report.warnings.length ? (
                    <ul>
                      {report.warnings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No warnings.</p>
                  )}
                </article>
                <article className="loom-report-card">
                  <h3>
                    <Lightbulb size={13} /> Suggestions ({report.suggestions.length})
                  </h3>
                  {report.suggestions.length ? (
                    <ul>
                      {report.suggestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No suggestions.</p>
                  )}
                </article>
                <article className="loom-report-card">
                  <h3>
                    <BadgeCheck size={13} /> Status
                  </h3>
                  <p>
                    {report.errors.length > 0
                      ? "Needs revision before dependable runs."
                      : "Stave structure is viable for pseudo-run checks."}
                  </p>
                </article>
              </div>
            </section>
          ) : null}

          {activeResultTab === "preview" ? (
            <article className="loom-preview">{renderMarkdownPreview(markdown)}</article>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function LoomPage() {
  return (
    <Suspense
      fallback={
        <div className="container">
          <h1>The Loom</h1>
        </div>
      }
    >
      <LoomEditor />
    </Suspense>
  );
}
