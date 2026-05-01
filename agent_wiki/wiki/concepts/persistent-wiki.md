# Persistent Wiki

Last updated: 2026-04-30

## Definition
A persistent wiki is a continuously maintained knowledge layer between raw
documents and question-answering. Instead of rediscovering facts per query, the
agent incrementally integrates new information into structured pages.

## Why it matters
- Knowledge compounds over time.
- Cross-references and synthesis are pre-built.
- Contradictions can be tracked explicitly.
- Query quality improves as structure improves.

## Operating model
- Ingest sources from `../../raw/`.
- Update summaries, concepts, and entities in place.
- Maintain `../index.md` and `../log.md` each run.

## Related
- `../overview.md`
- `../index.md`
- `../../../wiki.md`
