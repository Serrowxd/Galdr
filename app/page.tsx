"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StaveCard } from "@/components/StaveCard";
import { VegvisirLogo } from "@/components/VegvisirLogo";
import { staves } from "@/lib/mockData";

const FILTER_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "code", label: "Code", tags: ["review", "security", "lint", "testing", "automation"] },
  { id: "docs", label: "Writing", tags: ["docs", "api", "markdown", "changelog"] },
  { id: "agents", label: "Agents", tags: ["meta", "prompt", "optimization"] },
  { id: "data", label: "Data", tags: ["database", "schema", "sql"] },
  { id: "devops", label: "DevOps", tags: ["devops", "deploy", "validation", "ci", "git"] },
  { id: "translation", label: "Translation", tags: ["translation", "polyglot"] },
] as const;

export default function LandingPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const totalInvocations = useMemo(
    () => staves.reduce((sum, s) => sum + s.invocations, 0),
    [],
  );
  const totalScribes = useMemo(
    () => new Set(staves.map((s) => s.scribe)).size,
    [],
  );
  const avgSuccess = useMemo(
    () => Math.round(staves.reduce((sum, s) => sum + s.successRate, 0) / staves.length),
    [],
  );

  const filteredStaves = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const category = FILTER_CATEGORIES.find((c) => c.id === activeFilter);
    const categoryTags: readonly string[] | null =
      category && "tags" in category ? category.tags : null;

    return staves
      .filter((stave) => {
        if (lowered.length) {
          const matchesText =
            stave.title.toLowerCase().includes(lowered) ||
            stave.scribe.toLowerCase().includes(lowered) ||
            stave.description.toLowerCase().includes(lowered) ||
            stave.tags.some((t) => t.toLowerCase().includes(lowered));
          if (!matchesText) return false;
        }
        if (categoryTags) {
          if (!stave.tags.some((t) => categoryTags.includes(t))) return false;
        }
        return true;
      })
      .sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes));
  }, [query, activeFilter]);

  function formatBig(num: number): string {
    if (num >= 1000) {
      const k = num / 1000;
      const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
      return `${rounded}k`;
    }
    return num.toLocaleString();
  }

  return (
    <>
      <section className="page-hero" aria-labelledby="hero-title">
        <div className="container page-hero-inner">
          <div className="page-hero-copy">
            <p className="page-hero-tag">Open agent registry</p>
            <h1 id="hero-title" className="page-hero-title">
              Skills for your agents.
              <br />
              Built by the community.
            </h1>
            <p className="page-hero-sub">
              Download staves — markdown skill bundles for Claude, Codex, and any
              agent that reads instructions. Search, remix, publish.
            </p>
            <div className="page-hero-stats" aria-label="Registry stats">
              <span className="stat-tiny">
                <strong>{formatBig(staves.length)}</strong>staves
              </span>
              <span className="stat-tiny">
                <strong>{totalScribes}</strong>scribes
              </span>
              <span className="stat-tiny">
                <strong>{formatBig(totalInvocations)}</strong>invocations
              </span>
              <span className="stat-tiny">
                <strong>{avgSuccess}%</strong>avg success
              </span>
            </div>
          </div>
          <div className="page-hero-emblem" aria-hidden>
            <VegvisirLogo size={220} />
          </div>
        </div>
      </section>

      <div className="container">
        <div className="toolbar-row">
          <div className="search-bar" role="search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder='Search staves — "code review", "knowledge base", "deploy"…'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search staves"
            />
          </div>
        </div>

        <div className="filters" role="toolbar" aria-label="Stave filters">
          <span className="filters-label">Filter</span>
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`chip ${activeFilter === cat.id ? "is-on" : ""}`}
              onClick={() => setActiveFilter(cat.id)}
              aria-pressed={activeFilter === cat.id}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filteredStaves.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p className="muted">No staves match this search.</p>
          </div>
        ) : (
          <div className="stave-grid">
            {filteredStaves.map((stave) => (
              <StaveCard key={stave.id} stave={stave} />
            ))}
          </div>
        )}
      </div>

      <footer className="footer">
        <div className="container">
          <span>© 2026 Galdr — Open agent registry</span>
          <span>Markdown skill bundles for any agent that reads instructions.</span>
        </div>
      </footer>
    </>
  );
}
