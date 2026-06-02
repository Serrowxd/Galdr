"use client";

import { useEffect, useRef, useState } from "react";

/** Inline tag normalizer (mirrors lib/threads.ts normalizeTags, no server imports). */
function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export interface TagsInputProps {
  name: string;
  max?: number;
  initialTags?: string[];
  /** Called with the current tag list whenever it changes. */
  onTagsChange?: (tags: string[]) => void;
}

export function TagsInput({
  name,
  max = 8,
  initialTags = [],
  onTagsChange,
}: TagsInputProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Surface tag changes to the parent via callback (no DOM-scraping needed).
  useEffect(() => {
    onTagsChange?.(tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  function commit() {
    if (!draft.trim()) return;
    const normalized = normalizeTag(draft);
    if (!normalized) {
      setDraft("");
      return;
    }
    if (tags.includes(normalized)) {
      setDraft("");
      return;
    }
    if (tags.length >= max) {
      setDraft("");
      return;
    }
    setTags((prev) => [...prev, normalized]);
    setDraft("");
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip commas from typed input — commit handles them on keydown
    setDraft(e.target.value.replace(/,/g, ""));
  }

  function handleBlur() {
    if (draft.trim()) commit();
  }

  const atMax = tags.length >= max;

  return (
    <div
      className="tags-input"
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label="Tags"
    >
      {tags.map((tag, i) => (
        <span key={tag} className="tags-input__chip">
          {tag}
          <button
            type="button"
            className="tags-input__chip-remove"
            aria-label={`Remove tag ${tag}`}
            onClick={(e) => {
              e.stopPropagation();
              removeTag(i);
            }}
          >
            ×
          </button>
        </span>
      ))}
      {!atMax && (
        <input
          ref={inputRef}
          className="tags-input__field"
          type="text"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? "Add tags…" : ""}
          aria-label="Add a tag"
        />
      )}
      {atMax && (
        <span className="tags-input__limit-note">Max {max} tags</span>
      )}
      {/* Hidden field carries the serialized tags for any form that reads it */}
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
    </div>
  );
}
