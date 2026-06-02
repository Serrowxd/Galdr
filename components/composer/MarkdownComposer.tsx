"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { renderMarkdownPreview } from "@/lib/markdownPreview";
import { useAutoSave } from "@/hooks/useAutoSave";
import {
  clearDraft,
  listDrafts,
  loadDraft,
  pruneStaleDrafts,
  type ComposerScope,
  type DraftEntry,
} from "@/lib/composer/draftStorage";

export type { ComposerScope };

export interface MarkdownComposerProps {
  scope: ComposerScope;
  initialBody?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  maxLength: number;
  onSubmit: (body: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
  layout?: "full" | "inline";
  userId?: string | null;
}

type Tab = "write" | "preview" | "drafts";

// ─── Toolbar helper ──────────────────────────────────────────────────────────

function wrapSelection(
  ta: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
): void {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.slice(start, end) || placeholder;
  const next =
    ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
  // Use execCommand so native undo stack is preserved
  ta.focus();
  ta.setSelectionRange(start, end);
  document.execCommand("insertText", false, before + selected + after);
  // fallback if execCommand not available
  if (ta.value !== next) {
    ta.value = next;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  ta.setSelectionRange(start + before.length, start + before.length + selected.length);
}

function prependLine(
  ta: HTMLTextAreaElement,
  prefix: string,
  placeholder: string,
): void {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
  const selected = ta.value.slice(lineStart, end) || placeholder;
  const next =
    ta.value.slice(0, lineStart) + prefix + selected + ta.value.slice(end);
  ta.focus();
  ta.setSelectionRange(lineStart, end);
  document.execCommand("insertText", false, prefix + selected);
  if (ta.value !== next) {
    ta.value = next;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// ─── Mention popover ─────────────────────────────────────────────────────────

interface MentionResult {
  label: string;
  kind: "stave" | "scribe";
}

interface MentionPopoverProps {
  results: MentionResult[];
  selectedIndex: number;
  onSelect: (label: string) => void;
  style?: React.CSSProperties;
}

function MentionPopover({
  results,
  selectedIndex,
  onSelect,
  style,
}: MentionPopoverProps) {
  if (results.length === 0) return null;
  return (
    <ul className="composer-mention-popover" style={style} role="listbox">
      {results.map((r, i) => (
        <li
          key={`${r.kind}:${r.label}`}
          role="option"
          aria-selected={i === selectedIndex}
          className={i === selectedIndex ? "is-active" : undefined}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(r.label);
          }}
        >
          <span className="composer-mention-kind">{r.kind === "stave" ? "stave" : "scribe"}</span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function MarkdownComposer({
  scope,
  initialBody = "",
  placeholder = "Write something…",
  submitLabel = "POST",
  cancelLabel = "CANCEL",
  showCancel = true,
  maxLength,
  onSubmit,
  onCancel,
  layout = "full",
  userId = null,
}: MarkdownComposerProps) {
  const [tab, setTab] = useState<Tab>("write");
  const [body, setBody] = useState<string>(() => {
    // Hydrate from localStorage draft if available, fallback to initialBody
    if (typeof window !== "undefined") {
      const saved = loadDraft(scope, userId ?? null);
      if (saved?.body) return saved.body;
    }
    return initialBody;
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [drafts, setDrafts] = useState<Array<{ key: string } & DraftEntry>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave
  useAutoSave({ body, scope, userId: userId ?? null });

  // Prune stale drafts on mount
  useEffect(() => {
    pruneStaleDrafts();
  }, []);

  // Load drafts list when switching to Drafts tab
  useEffect(() => {
    if (tab === "drafts") {
      const loaded = listDrafts(scope, userId ?? null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts(loaded);
    }
  }, [tab, scope, userId]);

  // ── Toolbar actions ────────────────────────────────────────────────────────

  function toolbar(before: string, after: string, ph: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    wrapSelection(ta, before, after, ph);
    // sync React state
    setBody(ta.value);
  }

  function toolbarLine(prefix: string, ph: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    prependLine(ta, prefix, ph);
    setBody(ta.value);
  }

  const toolbarActions = useMemo(() => [
    { label: "B", title: "Bold", action: () => toolbar("**", "**", "bold text") },
    { label: "I", title: "Italic", action: () => toolbar("_", "_", "italic text") },
    { label: "S", title: "Strikethrough", action: () => toolbar("~~", "~~", "text") },
    { label: "</>", title: "Code", action: () => toolbar("`", "`", "code") },
    {
      label: "🔗",
      title: "Link",
      action: () => toolbar("[", "](url)", "link text"),
    },
    { label: "—", title: "List", action: () => toolbarLine("- ", "list item") },
    {
      label: '"',
      title: "Quote",
      action: () => toolbarLine("> ", "quoted text"),
    },
    { label: "H2", title: "Heading 2", action: () => toolbarLine("## ", "Heading") },
    { label: "H3", title: "Heading 3", action: () => toolbarLine("### ", "Heading") },
  ], []);

  // ── Mention detection ──────────────────────────────────────────────────────

  function detectMention(value: string, cursorPos: number) {
    const before = value.slice(0, cursorPos);
    const match = before.match(/@([\w-]*)$/);
    if (!match) {
      setMentionQuery(null);
      setMentionResults([]);
      return;
    }
    const q = match[1];
    setMentionQuery(q);
    setMentionIdx(0);

    // Calculate popover position (approximate — uses textarea coordinates)
    const ta = textareaRef.current;
    if (ta) {
      const rect = ta.getBoundingClientRect();
      // Rough character-based offset
      const lineHeight = 20;
      const charsPerLine = Math.floor(ta.clientWidth / 8);
      const line = Math.floor(cursorPos / Math.max(charsPerLine, 1));
      setMentionPos({
        top: rect.top + window.scrollY + lineHeight * (line + 1) + 4,
        left: rect.left + window.scrollX + 8,
      });
    }

    if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
    if (q.length < 2) {
      setMentionResults([]);
      return;
    }
    mentionDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/mentions?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          staves: { slug: string }[];
          scribes: { username: string }[];
        };
        const combined: MentionResult[] = [
          ...data.staves.map((s) => ({ label: s.slug, kind: "stave" as const })),
          ...data.scribes.map((s) => ({
            label: s.username,
            kind: "scribe" as const,
          })),
        ].slice(0, 8);
        setMentionResults(combined);
      } catch {
        // silently ignore network errors
      }
    }, 200);
  }

  function insertMention(label: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = ta.value.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    const after = ta.value.slice(cursor);
    const next = before.slice(0, atIdx) + "@" + label + " " + after;
    ta.value = next;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    setBody(next);
    setMentionQuery(null);
    setMentionResults([]);
    const newCursor = atIdx + label.length + 2;
    ta.setSelectionRange(newCursor, newCursor);
    ta.focus();
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    if (val.length > maxLength) return;
    setBody(val);
    detectMention(val, e.target.selectionStart);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter to submit
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
      return;
    }

    // Mention navigation
    if (mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => Math.min(i + 1, mentionResults.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIdx]?.label ?? "");
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
  }

  // Close mention popover on Escape when no results
  function handleKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }

  // Drag-drop image toast
  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    const hasImage = Array.from(e.dataTransfer.items).some(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    if (hasImage) {
      e.preventDefault();
      showToast("Image upload coming soon");
    }
  }

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
  }

  // Submit
  const handleSubmit = useCallback(async () => {
    if (submitting || !body.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onSubmit(body.trim());
      if (result.ok) {
        clearDraft(scope, userId ?? null);
        setBody("");
      } else {
        setSubmitError(result.error ?? "Something went wrong.");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }, [body, onSubmit, scope, submitting, userId]);

  function handleRestoreDraft(d: { body: string }) {
    setBody(d.body);
    setTab("write");
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const charsLeft = maxLength - body.length;
  const showCounter = charsLeft <= 1024;
  const isAnon = userId === null || userId === undefined;
  const draftsForScope = listDrafts(scope, userId ?? null);

  // ── Anon state ─────────────────────────────────────────────────────────────

  if (isAnon) {
    return (
      <div className={`composer composer--${layout} composer--anon`}>
        <textarea
          className="composer-field__textarea"
          placeholder={placeholder}
          disabled
          rows={layout === "inline" ? 3 : 5}
        />
        <div className="composer-anon-cta">
          <span>Sign in to post</span>
          <a href="/auth/sign-in" className="btn btn-primary btn-sm">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`composer composer--${layout}`}>
      {/* Tab bar */}
      <div className="composer-tabs" role="tablist">
        {(["write", "preview", "drafts"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`composer-tab${tab === t ? " is-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "drafts"
              ? `DRAFTS${draftsForScope.length > 0 ? ` (${draftsForScope.length})` : ""}`
              : t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Write tab */}
      {tab === "write" && (
        <>
          <div className="composer-toolbar" role="toolbar" aria-label="Formatting">
            {/* eslint-disable-next-line react-hooks/refs */}
            {toolbarActions.map((a) => (
              <button
                key={a.title}
                type="button"
                title={a.title}
                className="composer-toolbar-btn"
                onClick={a.action}
                tabIndex={-1}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="composer-field" style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              className="composer-field__textarea"
              value={body}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onDrop={handleDrop}
              placeholder={placeholder}
              rows={layout === "inline" ? 4 : 7}
              maxLength={maxLength}
              disabled={submitting}
              aria-label="Composer body"
            />

            {/* Mention popover */}
            {mentionQuery !== null && mentionResults.length > 0 && mentionPos && (
              <MentionPopover
                results={mentionResults}
                selectedIndex={mentionIdx}
                onSelect={insertMention}
                style={{
                  position: "fixed",
                  top: mentionPos.top,
                  left: mentionPos.left,
                  zIndex: 200,
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Preview tab */}
      {tab === "preview" && (
        <div className="composer-preview">
          {body.trim() ? (
            renderMarkdownPreview(body)
          ) : (
            <p className="composer-preview__empty">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {/* Drafts tab */}
      {tab === "drafts" && (
        <div className="composer-drafts">
          {drafts.length === 0 ? (
            <p className="composer-drafts__empty">No saved drafts for this composer.</p>
          ) : (
            <ul className="composer-drafts__list">
              {drafts.map((d) => (
                <li key={d.key} className="composer-drafts__item">
                  <div className="composer-drafts__meta">
                    <span className="composer-drafts__date">
                      {new Date(d.updatedAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRestoreDraft(d)}
                    >
                      Restore
                    </button>
                  </div>
                  <p className="composer-drafts__preview">
                    {d.body.slice(0, 120)}
                    {d.body.length > 120 ? "…" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="composer-footer">
        <div className="composer-footer__left">
          <span className="composer-hint">CMD+ENTER TO POST · DRAFTS AUTOSAVE</span>
          {submitError && (
            <span className="composer-error">{submitError}</span>
          )}
        </div>
        <div className="composer-footer__right">
          {showCounter && (
            <span
              className={`composer-counter${charsLeft < 200 ? " is-warn" : ""}${charsLeft < 50 ? " is-danger" : ""}`}
            >
              {charsLeft}
            </span>
          )}
          {showCancel && onCancel && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onCancel}
              disabled={submitting}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleSubmit()}
            disabled={submitting || !body.trim()}
          >
            {submitting ? "…" : submitLabel}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="composer-toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
