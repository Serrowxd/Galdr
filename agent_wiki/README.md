# agent_wiki

Implementation scaffold for the `wiki.md` pattern.

This folder contains:
- `raw/`: immutable source material (articles, papers, notes, exports)
- `wiki/`: LLM-maintained knowledge pages
- `../AGENTS.md`: operating schema for the wiki-maintainer agent

## Quick start
1. Put a new source file into `raw/`.
2. Ask your agent to run an ingest pass using root `AGENTS.md`.
3. Review changed pages under `wiki/`.
4. Keep `wiki/index.md` and `wiki/log.md` up to date each run.
