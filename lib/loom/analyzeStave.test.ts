import { describe, expect, it } from "vitest";

import { localAnalyzer } from "@/lib/loom/analyzeStave";

const analyze = (markdown: string) => localAnalyzer.analyzeStave({ markdown });

// A fully-formed stave: all required sections, 3+ instructions, 2+ constraints,
// an Output section, a token cap, and a format hint — should be flawless (100).
const complete = `# Stave: Code Reviewer

## Role
You are a meticulous code reviewer.

## Instructions
1. Analyze the code
2. Check for leaks
3. Verify error handling

## Constraints
- Never approve SQL injection
- Flag hardcoded credentials

## Output
Provide a structured format. Maximum response length: 2000 tokens.

Example: a short summary block.
`;

describe("localAnalyzer.analyzeStave (regression net for the in-page heuristics)", () => {
  it("scores a complete stave 100 with no findings", async () => {
    const r = await analyze(complete);
    expect(r.score).toBe(100);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.suggestions).toEqual([]);
  });

  it("flags each missing required section as an error", async () => {
    const r = await analyze("# Title only\n\nNo sections here.");
    expect(r.errors).toContain("Missing required section: ## Role");
    expect(r.errors).toContain("Missing required section: ## Instructions");
    expect(r.errors).toContain("Missing required section: ## Constraints");
    expect(r.errors).toHaveLength(3);
  });

  it("warns on a short instruction list and weak constraints", async () => {
    const md = `## Role
r
## Instructions
1. only one
## Constraints
- only one`;
    const r = await analyze(md);
    expect(r.warnings).toContain(
      "Instruction list is short; consider adding 3+ explicit directives.",
    );
    expect(r.warnings).toContain(
      "Constraints section could be stronger with 2+ guardrails.",
    );
  });

  it("suggests Output, token cap, and example when absent", async () => {
    const md = `## Role
r
## Instructions
1. a
2. b
3. c
## Constraints
- x
- y`;
    const r = await analyze(md);
    expect(r.suggestions).toContain(
      "Add an ## Output section to make responses more deterministic.",
    );
    expect(r.suggestions).toContain(
      "Specify max response length/tokens for predictable output size.",
    );
    expect(r.suggestions).toContain(
      "Include a concrete response example or format template.",
    );
  });

  it("applies the exact weighting (errors 26 / warnings 11 / suggestions 6) and floors at 0", async () => {
    // Empty markdown: 3 missing sections, both warnings, all 3 suggestions.
    // 100 - 3*26 - 2*11 - 3*6 = -18 -> clamped to 0.
    const r = await analyze("");
    expect(r.score).toBe(0);
    expect(r.errors).toHaveLength(3);
    expect(r.warnings).toHaveLength(2);
    expect(r.suggestions).toHaveLength(3);
  });
});
