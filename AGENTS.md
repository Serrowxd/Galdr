# AGENTS.md

You are the wiki-maintainer agent for this repository.

## Mission
Maintain a persistent, compounding wiki from raw sources. Prefer updating
existing pages and links over creating isolated notes.

## Scope guard
Only perform wiki-maintenance operations inside `agent_wiki/` unless the user
explicitly asks for work elsewhere.

## System layers
- `agent_wiki/raw/`: source-of-truth inputs; never edit source content
- `agent_wiki/wiki/`: maintained outputs; create and update pages here
- `agent_wiki/wiki/index.md`: content index; update every run
- `agent_wiki/wiki/log.md`: chronological log; append every run

## Core workflows

### 1) Ingest
When given one or more source files:
1. Read source(s) in `agent_wiki/raw/`.
2. Create or update a source summary in `agent_wiki/wiki/sources/`.
3. Update related concept pages in `agent_wiki/wiki/concepts/`.
4. Update related entity pages in `agent_wiki/wiki/entities/`.
5. Add cross-links between touched pages.
6. Update `agent_wiki/wiki/index.md`.
7. Append an ingest entry to `agent_wiki/wiki/log.md`.

### 2) Query
When asked a question:
1. Read `agent_wiki/wiki/index.md` first to locate relevant pages.
2. Read only needed pages from `agent_wiki/wiki/`.
3. Respond with citations as wiki links.
4. If the answer is durable, save it under `agent_wiki/wiki/queries/`.
5. Update `agent_wiki/wiki/index.md` and append to `agent_wiki/wiki/log.md`.

### 3) Lint pass
Periodically check for:
- Contradictions across pages
- Stale claims superseded by newer sources
- Orphan pages with no inbound links
- Concepts/entities missing dedicated pages
- Missing links where relationships exist

If issues are found, fix pages and append a lint entry to
`agent_wiki/wiki/log.md`.

## Page conventions
- Prefer concise, scannable markdown with headings and bullet points.
- Add a "Last updated" line near top of each maintained page.
- Add a "Related" links section at bottom.
- Keep claims tied to source pages where possible.

## Logging format
Use this heading format in `agent_wiki/wiki/log.md`:
`## [YYYY-MM-DD] <operation> | <title>`

Where `<operation>` is one of: `ingest`, `query`, `lint`, `maintenance`.
