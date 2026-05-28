"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

type RegistryControlsProps = {
  allTags: string[];
};

export function RegistryControls({ allTags }: RegistryControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const tag = searchParams.get("tag") ?? "all";
  const sort = searchParams.get("sort") === "new" ? "new" : "top";

  const update = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    // Any control change resets pagination.
    params.delete("page");
    router.replace(`/registry?${params.toString()}`);
  };

  return (
    <>
      <div className="toolbar-row">
        <form
          className="search-bar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: query.trim() });
          }}
        >
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Search staves, descriptions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search staves"
          />
        </form>

        <select
          className="select"
          style={{ maxWidth: 200 }}
          value={tag}
          onChange={(e) => update({ tag: e.target.value })}
          aria-label="Filter by tag"
        >
          <option value="all">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="filters" role="group" aria-label="Sort">
        <span className="filters-label">Sort</span>
        <button
          type="button"
          className={`chip ${sort === "top" ? "is-on" : ""}`}
          aria-pressed={sort === "top"}
          onClick={() => update({ sort: "top" })}
        >
          Top
        </button>
        <button
          type="button"
          className={`chip ${sort === "new" ? "is-on" : ""}`}
          aria-pressed={sort === "new"}
          onClick={() => update({ sort: "new" })}
        >
          New
        </button>
      </div>
    </>
  );
}
