"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MarkdownComposer } from "@/components/composer/MarkdownComposer";
import { TagsInput } from "@/components/composer/TagsInput";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type Format = "discussion" | "documentation";
type Category = "tutorial" | "pattern" | "question" | "showcase" | "meta";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "tutorial", label: "Tutorial" },
  { value: "pattern", label: "Pattern" },
  { value: "question", label: "Question" },
  { value: "showcase", label: "Showcase" },
  { value: "meta", label: "Meta" },
];

// ──────────────────────────────────────────────
// FormatPicker
// ──────────────────────────────────────────────

function FormatPicker({
  value,
  onChange,
}: {
  value: Format;
  onChange: (f: Format) => void;
}) {
  return (
    <div className="format-picker" role="radiogroup" aria-label="Thread format">
      <label
        className={`format-picker-card${value === "discussion" ? " is-selected" : ""}`}
      >
        <input
          type="radio"
          name="format"
          value="discussion"
          checked={value === "discussion"}
          onChange={() => onChange("discussion")}
          className="sr-only"
        />
        <span className="format-picker-card__title">Discussion</span>
        <span className="format-picker-card__desc">
          A regular thread — question, showcase, conversation
        </span>
      </label>
      <label
        className={`format-picker-card${value === "documentation" ? " is-selected" : ""}`}
      >
        <input
          type="radio"
          name="format"
          value="documentation"
          checked={value === "documentation"}
          onChange={() => onChange("documentation")}
          className="sr-only"
        />
        <span className="format-picker-card__title">Documentation</span>
        <span className="format-picker-card__desc">
          An article format with a right-rail outline from your h2/h3 headings
        </span>
      </label>
    </div>
  );
}

// ──────────────────────────────────────────────
// CategoryPicker
// ──────────────────────────────────────────────

function CategoryPicker({
  value,
  onChange,
}: {
  value: Category | null;
  onChange: (c: Category) => void;
}) {
  return (
    <div className="category-picker" role="radiogroup" aria-label="Category">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          className={`category-picker-btn${value === cat.value ? " is-selected" : ""}`}
          onClick={() => onChange(cat.value)}
          aria-pressed={value === cat.value}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// NewThreadPage
// ──────────────────────────────────────────────

export interface NewThreadPageProps {
  userId: string;
  attached: { staveFamilyId: string; staveSlug: string } | null;
}

export function NewThreadPage({ userId, attached }: NewThreadPageProps) {
  const router = useRouter();

  const [format, setFormat] = useState<Format>("discussion");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [tagsJson, setTagsJson] = useState<string>("[]");
  const [isAttached, setIsAttached] = useState(attached !== null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const staveFamilyId = isAttached && attached ? attached.staveFamilyId : null;
  const staveSlug = isAttached && attached ? attached.staveSlug : null;
  const needsCategory = !staveFamilyId;

  function handleDetach() {
    setIsAttached(false);
  }

  async function handleSubmit(body: string): Promise<{ ok: boolean; error?: string }> {
    // Client-side validation
    if (!title.trim()) {
      setTitleError("Title is required.");
      return { ok: false, error: "Title is required." };
    }
    if (needsCategory && !category) {
      setCategoryError("Category is required for standalone threads.");
      return { ok: false, error: "Category is required for standalone threads." };
    }

    setTitleError(null);
    setCategoryError(null);

    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse(tagsJson) as string[];
    } catch {
      parsedTags = [];
    }

    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        opBody: body,
        format,
        category: needsCategory ? category : null,
        staveFamilyId,
        tags: parsedTags,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text };
    }

    const { slug } = (await res.json()) as { slug: string };
    router.push(`/tavern/${slug}`);
    return { ok: true };
  }

  // TagsInput uses a hidden field; we sync it via a wrapper that reads the hidden input
  // value on form change. Simpler: lift state up via an onTagsChange callback.
  // Since TagsInput manages its own state + hidden input, we intercept it with a
  // parent onChange handler on the wrapper div.
  function handleTagsWrapperChange(e: React.ChangeEvent<HTMLDivElement>) {
    const hidden = (e.target as HTMLElement).closest(".tags-input-wrapper")
      ?.querySelector<HTMLInputElement>('input[type="hidden"]');
    if (hidden) {
      setTagsJson(hidden.value);
    }
  }

  return (
    <div className="new-thread-page">
      <div className="new-thread-page__header">
        <h1 className="new-thread-page__title">New Thread</h1>
        {staveSlug && isAttached && (
          <p className="new-thread-page__subtitle">
            Posting to the discussion thread for{" "}
            <a href={`/stave/${staveSlug}`} className="new-thread-page__stave-link">
              {staveSlug}
            </a>
          </p>
        )}
      </div>

      <div className="new-thread-page__form">
        {/* Format */}
        <div className="new-thread-page__field">
          <label className="new-thread-page__label">Format</label>
          <FormatPicker value={format} onChange={setFormat} />
        </div>

        {/* Title */}
        <div className="new-thread-page__field">
          <label className="new-thread-page__label" htmlFor="thread-title">
            Title <span className="new-thread-page__required">*</span>
          </label>
          <input
            id="thread-title"
            className={`new-thread-page__input${titleError ? " is-error" : ""}`}
            type="text"
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            maxLength={140}
            placeholder="Give your thread a clear, specific title"
            required
            aria-describedby={titleError ? "title-error" : undefined}
          />
          <div className="new-thread-page__field-footer">
            {titleError ? (
              <span id="title-error" className="new-thread-page__field-error">
                {titleError}
              </span>
            ) : (
              <span />
            )}
            <span className="new-thread-page__char-count">
              {title.length}/140
            </span>
          </div>
        </div>

        {/* Stave attachment chip OR category picker */}
        {isAttached && staveSlug ? (
          <div className="new-thread-page__field">
            <label className="new-thread-page__label">Attachment</label>
            <div className="new-thread-page__attach-row">
              <span className="new-thread-page__attach-chip">
                Attached to{" "}
                <span className="new-thread-page__attach-slug">{staveSlug}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleDetach}
              >
                Detach
              </button>
            </div>
          </div>
        ) : (
          <div className="new-thread-page__field">
            <label className="new-thread-page__label">
              Category <span className="new-thread-page__required">*</span>
            </label>
            <CategoryPicker value={category} onChange={(c) => {
              setCategory(c);
              if (categoryError) setCategoryError(null);
            }} />
            {categoryError && (
              <span className="new-thread-page__field-error">{categoryError}</span>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="new-thread-page__field">
          <label className="new-thread-page__label">
            Tags{" "}
            <span className="new-thread-page__label-hint">
              (optional, up to 8)
            </span>
          </label>
          {/* We wrap TagsInput and intercept change events to sync tagsJson */}
          <div
            className="tags-input-wrapper"
            onChange={handleTagsWrapperChange as unknown as React.ChangeEventHandler<HTMLDivElement>}
          >
            <TagsInput name="tags" max={8} />
          </div>
        </div>

        {/* Composer */}
        <div className="new-thread-page__field">
          <label className="new-thread-page__label">Post body</label>
          <MarkdownComposer
            scope={{ type: "new-thread" }}
            maxLength={65536}
            userId={userId}
            submitLabel="POST THREAD"
            showCancel={false}
            onSubmit={handleSubmit}
            placeholder="Write your post…"
          />
        </div>
      </div>
    </div>
  );
}
