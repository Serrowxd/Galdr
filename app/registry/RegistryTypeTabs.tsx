"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { value: "all", label: "All" },
  { value: "stave", label: "Staves" },
  { value: "grimoire", label: "Grimoires" },
] as const;

type Counts = { all: number; stave: number; grimoire: number };

export function RegistryTypeTabs({ counts }: { counts: Counts }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("type") ?? "all";

  const select = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("type");
    else params.set("type", value);
    params.delete("page");
    router.replace(`/registry?${params.toString()}`);
  };

  return (
    <div className="filters" role="group" aria-label="Type">
      <span className="filters-label">Type</span>
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          className={`chip ${current === t.value ? "is-on" : ""}`}
          aria-pressed={current === t.value}
          onClick={() => select(t.value)}
        >
          {t.label} <span className="chip-count">{counts[t.value]}</span>
        </button>
      ))}
    </div>
  );
}
