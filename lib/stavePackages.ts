export type StavePackageFile = { path: string; content: string };

function files(map: Record<string, string>): StavePackageFile[] {
  return Object.entries(map).map(([path, content]) => ({ path, content }));
}

/** Static markdown bundles shown on each stave detail page (package inspector). */
const PACKAGES: Record<string, StavePackageFile[]> = {
  "code-reviewer": files({
    "README.md": `# Code Reviewer

Community stave for repository audits. Bindings pull ESLint, AST parsers, and a vuln hint DB.

## Quick start
1. Point the agent at a repo root or PR diff.
2. Invoke with trace level **strict** for CI gates.
`,
    "AGENTS.md": `# Agents overlay

## Role
Senior reviewer prioritizing exploitability and perf regressions.

## Instructions
1. Enumerate changed paths and classify risk.
2. Cross-check auth boundaries and data stores.
3. Demand fixes with references, not vague advice.

## Constraints
- Never waive SQLi or hardcoded secrets.
- Cap findings per file to avoid noise floods.
`,
    "skills/security.md": `### Security heuristics
- Parameterized queries only.
- Reject string-built shell.
- Flag deserialization of untrusted blobs.`,
  }),

  "doc-generator": files({
    "README.md": `# Doc Generator

Emit Markdown docs from symbols: signatures, params, returns, examples.

## Outputs
- \`docs/api.md\` — public surface
- \`docs/internal.md\` — package-private notes
`,
    "templates/page.md": `# Page template

## {{title}}

### Signature
\`\`\`
{{signature}}
\`\`\`

### Example
{{example}}
`,
    "config/bindings.json": `{
  "parsers": ["typescript", "python"],
  "emitExamples": true
}`,
  }),

  "test-forge": files({
    "README.md": `# Test Forge

Generate tests from traces + signatures. Keeps fixtures beside specs.

## Layout
\`\`\`
tests/
  unit/
  integration/
\`\`\`
`,
    "prompts/cases.md": `## Case shapes
- Happy path + one adversarial input.
- Async timeouts mocked at boundaries.
- Snapshot only for deterministic serializers.`,
    "skills/assertions.md": `- Prefer arrange/act/assert blocks.
- Name tests after behavior, not method names.`,
  }),

  "changelog-scribe": files({
    "README.md": `# Changelog Scribe

Maps commits to Keep a Changelog sections.

## Inputs
- Conventional commits (preferred)
- Issue references
`,
    "sections/README.md": `## Added / Changed / Fixed / Removed
Bucket each line under a single heading per release.`,
    "filters/noise.md": `Skip: chore(deps), typo commits without user impact.`,
  }),

  "schema-weaver": files({
    "README.md": `# Schema Weaver

NL requirements → relational schema + migration sketches + seed outline.

## Deliverables
1. ERD summary (tables + keys)
2. Forward migration SQL
3. Rollback notes
`,
    "patterns/normalization.md": `- Third normal form default.
- Document intentional denorms with rationale.`,
    "snippets/indexes.md": `### Index checklist
- FK columns indexed.
- Filter predicates covered where selective.`,
  }),

  "prompt-alchemist": files({
    "README.md": `# Prompt Alchemist

Meta-stave: score prompts against benchmarks, mutate, converge.

## Loop
1. Baseline run
2. Mutate constraints
3. Re-score until plateau
`,
    "experiments/grid.md": `| Variant | Score | Notes |
| --- | --- | --- |
| A | — | baseline |
| B | — | tighter role |
`,
    "guardrails.md": `- Freeze tool list during eval.
- Log token ceilings per iteration.`,
  }),

  "deploy-warden": files({
    "README.md": `# Deploy Warden

Release gates: migrations applied, feature flags consistent, health probes green.

## Preconditions
- Staging soak passed
- Rollback artifact pinned
`,
    "checklists/prod.md": `- [ ] DB backups verified
- [ ] Canary route weights
- [ ] Error budgets OK`,
    "bindings/probes.md": `HTTP GET /health expects 200 within 400ms.`,
  }),

  "rune-translator": files({
    "README.md": `# Rune Translator

Translate between languages while preserving control flow and tests intent.

## Inputs
- Source tree + target runtime version
- Existing tests as oracle when possible
`,
    "maps/types.md": `### Type mapping hints
- Nullable ↔ optional discipline explicit.
- Errors as typed results vs exceptions documented.`,
    "examples/pairs.md": `- Python dataclass → TypeScript interface + zod schema sketch.`,
  }),
};

export function getStavePackageFiles(
  staveId: string,
): StavePackageFile[] | undefined {
  return PACKAGES[staveId];
}
