export type Stave = {
  id: string;
  title: string;
  scribe: string;
  /** URL segment for /grimoire/[slug] */
  scribeSlug: string;
  description: string;
  commentsCount: number;
  viewsCount: number;
  upvotes: number;
  downvotes: number;
  publishedAt: string;
  popularityScore: number;
  bindings: number;
  successRate: number;
  tags: string[];
  invocations: number;
};

export type SavedScribe = {
  id: string;
  name: string;
  bio: string;
  focus: string[];
  stavesCount: number;
  followers: number;
  successRate: number;
};

export const staves: Stave[] = [
  {
    id: "code-reviewer",
    title: "Code Reviewer",
    scribe: "Runehammer",
    scribeSlug: "runehammer",
    description:
      "A severe review stave that hunts security flaws, performance regressions, and style breaks across mixed repositories.",
    commentsCount: 182,
    viewsCount: 11672,
    upvotes: 1240,
    downvotes: 92,
    publishedAt: "2026-04-21T10:30:00.000Z",
    popularityScore: 96,
    bindings: 12,
    successRate: 94,
    tags: ["review", "security", "lint"],
    invocations: 3842,
  },
  {
    id: "doc-generator",
    title: "Doc Generator",
    scribe: "ValkyrIO",
    scribeSlug: "valkyrio",
    description:
      "Extracts APIs and symbols to forge Markdown docs with signatures, examples, and maintenance notes.",
    commentsCount: 74,
    viewsCount: 6240,
    upvotes: 678,
    downvotes: 41,
    publishedAt: "2026-04-25T16:40:00.000Z",
    popularityScore: 88,
    bindings: 8,
    successRate: 91,
    tags: ["docs", "api", "markdown"],
    invocations: 2156,
  },
  {
    id: "test-forge",
    title: "Test Forge",
    scribe: "Ironclad",
    scribeSlug: "ironclad",
    description:
      "Builds unit and integration tests from function signatures, constraints, and runtime traces.",
    commentsCount: 156,
    viewsCount: 13290,
    upvotes: 1390,
    downvotes: 134,
    publishedAt: "2026-04-18T13:15:00.000Z",
    popularityScore: 97,
    bindings: 15,
    successRate: 87,
    tags: ["testing", "automation"],
    invocations: 5210,
  },
  {
    id: "changelog-scribe",
    title: "Changelog Scribe",
    scribe: "Norsewind",
    scribeSlug: "norsewind",
    description:
      "Reads commit history and emits release narratives in strict Keep a Changelog structure.",
    commentsCount: 38,
    viewsCount: 4010,
    upvotes: 412,
    downvotes: 25,
    publishedAt: "2026-04-27T08:55:00.000Z",
    popularityScore: 76,
    bindings: 3,
    successRate: 98,
    tags: ["git", "changelog", "ci"],
    invocations: 1892,
  },
  {
    id: "schema-weaver",
    title: "Schema Weaver",
    scribe: "Deepforge",
    scribeSlug: "deepforge",
    description:
      "Turns natural language requirements into relational schemas, migrations, and seed plans.",
    commentsCount: 109,
    viewsCount: 8355,
    upvotes: 915,
    downvotes: 78,
    publishedAt: "2026-04-11T21:10:00.000Z",
    popularityScore: 84,
    bindings: 22,
    successRate: 82,
    tags: ["database", "schema", "sql"],
    invocations: 4103,
  },
  {
    id: "prompt-alchemist",
    title: "Prompt Alchemist",
    scribe: "Ashborn",
    scribeSlug: "ashborn",
    description:
      "A meta-stave that refines other prompts through score-driven iterations and benchmark loops.",
    commentsCount: 204,
    viewsCount: 17120,
    upvotes: 1876,
    downvotes: 161,
    publishedAt: "2026-04-29T18:25:00.000Z",
    popularityScore: 99,
    bindings: 7,
    successRate: 89,
    tags: ["meta", "prompt", "optimization"],
    invocations: 6721,
  },
  {
    id: "deploy-warden",
    title: "Deploy Warden",
    scribe: "Frostguard",
    scribeSlug: "frostguard",
    description:
      "Validates release readiness, environment integrity, and deployment dependencies before ship.",
    commentsCount: 95,
    viewsCount: 7924,
    upvotes: 850,
    downvotes: 57,
    publishedAt: "2026-04-23T12:05:00.000Z",
    popularityScore: 90,
    bindings: 19,
    successRate: 96,
    tags: ["devops", "deploy", "validation"],
    invocations: 2934,
  },
  {
    id: "rune-translator",
    title: "Rune Translator",
    scribe: "ElderScroll",
    scribeSlug: "elderscroll",
    description:
      "Translates code between language stacks while preserving logic, patterns, and coverage intent.",
    commentsCount: 236,
    viewsCount: 19480,
    upvotes: 1698,
    downvotes: 402,
    publishedAt: "2026-04-30T06:40:00.000Z",
    popularityScore: 93,
    bindings: 31,
    successRate: 78,
    tags: ["translation", "polyglot"],
    invocations: 8102,
  },
];

export const loomOutputMock = `> Initializing Stave: Code Reviewer v1.2.3
> Loading bindings: [eslint-core, ast-parser, vuln-db]
> Binding check: 3/3 resolved ok

[00:00:01] Parsing input repository...
[00:00:02] Scanning 14 files across 3 directories
[00:00:03] AST analysis complete

[00:00:04] WARN: Potential SQL injection in /src/db/queries.ts:42
[00:00:05] WARN: Hardcoded API key in /src/config/env.ts:7

[00:00:06] OK: Error handling coverage 92%
[00:00:07] OK: No N+1 patterns detected
[00:00:07] OK: Memory allocation within bounds

--- Review Complete ---
Risk Level: HIGH
Issues Found: 2
Recommendation: REQUEST_CHANGES

> Stave execution finished in 7.2s
> Success: true`;

export const grimoireStats = {
  totalStaves: 14,
  totalInvocations: 2840,
  successRate: 94,
  bindingsUsed: 38,
};

export const authoredStaves: Stave[] = [
  staves[0],
  staves[2],
  staves[4],
  staves[7],
];

export const savedScribes: SavedScribe[] = [
  {
    id: "runehammer",
    name: "Runehammer",
    bio: "Builds strict review staves that catch regressions before they reach production.",
    focus: ["review", "security", "performance"],
    stavesCount: 14,
    followers: 1842,
    successRate: 94,
  },
  {
    id: "valkyrio",
    name: "ValkyrIO",
    bio: "Specializes in docs-forging workflows with clean API narratives and examples.",
    focus: ["docs", "api", "markdown"],
    stavesCount: 9,
    followers: 1268,
    successRate: 91,
  },
  {
    id: "frostguard",
    name: "Frostguard",
    bio: "Maintains release wards for deployment readiness, CI health, and rollback safety.",
    focus: ["devops", "deploy", "validation"],
    stavesCount: 11,
    followers: 1506,
    successRate: 96,
  },
  {
    id: "ashborn",
    name: "Ashborn",
    bio: "Refines prompts into high-confidence invocations using benchmark-driven tuning.",
    focus: ["prompt", "automation", "optimization"],
    stavesCount: 7,
    followers: 2134,
    successRate: 89,
  },
];
