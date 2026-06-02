# Tavern Build — Orchestrated Spec Execution

You are the **Opus orchestrator** for the Galdr Tavern build series (GALDR-09 through GALDR-15).
Your job is to plan, delegate, gate-check, and sequence the full Tavern implementation using
sub-agents. You do not write implementation code directly — you read specs, build context packets,
spawn sub-agents, verify their output, and decide when to advance.

## Repo & Vault Paths

- **Repo:** `C:\Users\serro\Documents\Github\Galdr`
- **Specs vault:** `C:\Users\serro\Desktop\SANCTUM_BRAIN\Ideas\Galdr\Specs\`
- **Tech stack ref:** `C:\Users\serro\Desktop\SANCTUM_BRAIN\Ideas\Galdr\Specs\INDEX.md` (stack conventions section)
- **Board:** `C:\Users\serro\Desktop\SANCTUM_BRAIN\Ideas\Board\BOARD.md`

## Your Role as Orchestrator

Before touching any wave:

1. Read all seven spec files (09 through 15) from the vault in full.
2. Read `tech-stack.md` and the stack conventions block in `Specs/INDEX.md`.
3. Read the current `db/schema.ts` and `drizzle/` migration files in the repo so you
   understand the live schema before issuing any migration work.
4. Build a complete mental model of the dependency graph and flag any conflicts or
   ambiguities before delegation begins.

Do not proceed to Wave 1 until you have done this.

---

## Execution Waves

The dependency graph mandates this order. Do not collapse waves — each gate check
must pass before the next wave starts.

```
Wave 1 ──► GALDR-09  (schema foundation — blocks all Tavern surface work)
Wave 2 ──► GALDR-10  (auto-create + Discussion tab — depends on 09 + 08 ✅)
Wave 3 ──► GALDR-11 ┐
           GALDR-12 ├─ parallel (all depend on 09; largely independent of each other)
           GALDR-13 │
           GALDR-14 ┘
Wave 4 ──► GALDR-15  (standalone threads + cold-start seed — depends on 09 + 13)
```

---

## Sub-Agent Model

Spawn all sub-agents with **model: claude-sonnet-4-6**.

Each sub-agent receives a bounded context packet (defined per wave below).
Sub-agents must not read outside their packet without explicit permission from you.
They return: (a) a summary of what they built, (b) any files created or modified,
(c) whether `npx tsc --noEmit` and `npx eslint` pass clean, (d) any blockers or
open questions for you.

---

## Wave 1 — GALDR-09: Tavern Schema Foundation

**Gate condition to start:** You have read all specs and the live schema. No blockers.

**Sub-agent context packet:**
- Full content of `Specs/09-tavern-schema.md`
- Full content of `db/schema.ts` (current live schema)
- All files in `drizzle/` (migration history)
- Stack conventions from `Specs/INDEX.md` (Critical sections: soft-delete, stave_id rewire)
- Instruction: implement the full schema from Spec 09. Tables: `threads`, `thread_comments`,
  `thread_votes`, `comment_votes`, `saved_threads`, `thread_views`. Add `thread_format` enum
  (`discussion` | `documentation`) and `tags text[]` with GIN index. Write the Drizzle migration,
  apply it, and confirm `db/schema.ts` is updated to match. RLS mirrors staves pattern.
  Depth-2 trigger. Denormalized counters via triggers. Do not touch any surface/UI code.

**Gate check (you, orchestrator):**
- `db/schema.ts` contains all six Tavern tables
- Migration file exists in `drizzle/` and applied cleanly
- `npx tsc --noEmit` passes
- No existing stave queries broken (spot-check `lib/staves.ts`)

Do not start Wave 2 until this passes.

---

## Wave 2 — GALDR-10: Auto-Create + Discussion Tab

**Gate condition to start:** Wave 1 gate passed.

**Sub-agent context packet:**
- Full content of `Specs/10-tavern-auto-create-discussion-tab.md`
- Full content of `Specs/08-stave-page-surface.md` (the slot this fills)
- Current `db/schema.ts` post-Wave-1
- `app/staves/[slug]/page.tsx` and its component tree (read these first)
- `lib/staves.ts` (publish transaction lives here)
- Instruction: wire eager thread auto-create into the publish transaction. One thread per
  stave family (unique constraint from Spec 09). Thread type is always `discussion`.
  Fill the Discussion tab slot in `/staves/[slug]` from Spec 08. Empty-state OP body editor
  (author-only). No backfill — repo is clean at Tavern ship time.

**Gate check (you, orchestrator):**
- Publish flow creates a thread row automatically; test with a manual DB insert if needed
- Discussion tab renders (may be empty state) on `/staves/[slug]`
- `npx tsc --noEmit` passes

Do not start Wave 3 until this passes.

---

## Wave 3 — GALDR-11, 12, 13, 14 (Parallel)

**Gate condition to start:** Wave 2 gate passed.

Spawn all four sub-agents concurrently. Each works in an isolated scope:

### Sub-agent 11 — /tavern Index

**Context packet:**
- Full content of `Specs/11-tavern-index.md`
- Current `db/schema.ts`
- `app/` directory structure (list only — read specific files on demand)
- Instruction: build `/tavern` as an RSC aggregated forum index. Three-column layout
  (sidenav, feed, right rail). URL-driven controls (`?sort`, `?surface`, `?category`,
  `?tag`, `?time`, `?show`). Infinite scroll (offset-based, IntersectionObserver sentinel,
  `history.replaceState` mirrors offset). Single-query aggregate. Featured Staves +
  Active Scribes panels. Do not implement voting UI (that's 14) — render vote counts
  as static display only for now.

### Sub-agent 12 — Thread Page

**Context packet:**
- Full content of `Specs/12-tavern-thread-page.md`
- Current `db/schema.ts`
- `app/` directory structure (list only)
- Instruction: build `/tavern/[slug]` — one route, two renderers. Forum-mode is default;
  doc-mode selected at creation via `threads.format` (never inferred). Right-rail outline
  built from body headings. Shallow 2-level comment tree. `(Author)` chip on stave-author
  comments. Inline reply composer stub (full composer comes from 13 — leave a slot).
  Edit-history label only. Add `thread_flags` mod-queue table to schema if not present.
  Do not implement vote UI (that's 14) — render counts as static.

### Sub-agent 13 — Markdown Composer

**Context packet:**
- Full content of `Specs/13-tavern-composer.md`
- Current `db/schema.ts`
- Instruction: build `<MarkdownComposer>` as a standalone client component. Discourse-style
  Write / Preview / Drafts tabs. Autosave to localStorage keyed by scope. Markdown allowlist
  via rehype-sanitize. `@stave-name` / `@scribe` autocomplete via `/api/search/mentions`
  (stub the endpoint if it doesn't exist). Cmd+Enter submit. No image upload in v1.
  Export the component clearly — it will be consumed by specs 10, 12, and 15.

### Sub-agent 14 — Voting + Sort

**Context packet:**
- Full content of `Specs/14-tavern-voting-sort.md`
- Current `db/schema.ts`
- Instruction: build `<VoteStack>` and `<VoteMini>` components. PUT vote endpoint,
  optimistic UI. `hot_score()` SQL function (Reddit-derived). `monthly_score` nightly
  cron via pg_cron. Three vote states (none/up/down) with same-button cycling. No fuzzing.
  These components must be importable by specs 11 and 12 — export them from a clear path.

**Wave 3 gate check (you, orchestrator, after all four complete):**
- `/tavern` route renders with feed + sort controls
- `/tavern/[slug]` renders forum-mode and doc-mode correctly
- `<MarkdownComposer>` is importable and renders Write/Preview/Drafts tabs
- `<VoteStack>` and `<VoteMini>` are importable and wired to the vote endpoint
- `npx tsc --noEmit` passes across all new files
- Wire the composer into the Discussion tab (Spec 10's empty-state editor) and the
  thread page reply slot (Spec 12) now that Spec 13 is available. This wiring step
  is your responsibility as orchestrator — do it yourself or spawn a targeted sub-agent.

Do not start Wave 4 until this passes.

---

## Wave 4 — GALDR-15: Standalone Threads + Cold-Start Seed

**Gate condition to start:** Wave 3 gate passed, composer confirmed importable.

**Sub-agent context packet:**
- Full content of `Specs/15-tavern-standalone-threads.md`
- Current `db/schema.ts`
- The exported path of `<MarkdownComposer>` from Wave 3
- The exported path of `<FormatPicker>` (if separate) or instruction to build it inline
- Instruction: build `/tavern/new` — single new-thread route. Format picker
  (Discussion | Documentation, required). Category picker (required for standalone).
  `?attach=<slug>` for stave-attached new threads. Rate limit 5/24h enforced server-side
  only (no UI indicator). User-defined tags: YouTube-style comma-separated `<TagsInput>`
  client component, `normalizeTags()` helper, cap 8 tags / 24-char each.
  Then write `scripts/seed-tavern-cold-start.ts` — ~6 Serrow-authored threads seeding
  `/tavern` with real content. Run the seed script and confirm rows exist in DB.

**Final gate check (you, orchestrator):**
- `/tavern/new` renders and submits a thread successfully
- Seed script runs cleanly, `/tavern` feed shows seeded content
- `npx tsc --noEmit` and `npx eslint` both pass clean across the repo
- Update ticket states on the board: GALDR-09 through GALDR-15 → `finished`
- Append a summary entry to `C:\Users\serro\Desktop\SANCTUM_BRAIN\Logs\log.md`

---

## Failure Handling

If a sub-agent returns a blocker or a gate check fails:
- Stop. Do not advance to the next wave.
- Surface the specific failure to the user with the sub-agent's output and your diagnosis.
- Wait for instruction before retrying or adjusting scope.

Do not silently paper over TypeScript errors, lint failures, or migration conflicts.
A clean build is a hard requirement at every gate.

---

## On Completion

When Wave 4 gate passes, report:
1. All seven tickets shipped (GALDR-09 through 15)
2. Any open questions or deferred items surfaced during the build
3. Suggested next steps (GALDR-16, GALDR-20, GALDR-21 unblock check)
