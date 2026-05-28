export interface CheckReport {
  score: number; // 0–100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface StaveAnalyzer {
  analyzeStave(input: { markdown: string }): Promise<CheckReport>;
}

/**
 * The honest default: the structural heuristics that have always backed the Loom,
 * now async and isolated. No streaming, no fabricated terminal output. A future
 * model-backed analyzer plugs into the same interface — see getStaveAnalyzer.
 */
export const localAnalyzer: StaveAnalyzer = {
  async analyzeStave({ markdown }) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const hasRole = markdown.includes("## Role");
    const hasInstructions = markdown.includes("## Instructions");
    const hasConstraints = markdown.includes("## Constraints");
    const hasOutput = markdown.includes("## Output");

    if (!hasRole) errors.push("Missing required section: ## Role");
    if (!hasInstructions) errors.push("Missing required section: ## Instructions");
    if (!hasConstraints) errors.push("Missing required section: ## Constraints");

    const instructionCount = markdown
      .split("\n")
      .filter((line) => /^\d+\.\s/.test(line.trim())).length;
    if (instructionCount < 3) {
      warnings.push("Instruction list is short; consider adding 3+ explicit directives.");
    }

    const constraintCount = markdown
      .split("\n")
      .filter((line) => line.trim().startsWith("-")).length;
    if (constraintCount < 2) {
      warnings.push("Constraints section could be stronger with 2+ guardrails.");
    }

    if (!hasOutput) {
      suggestions.push("Add an ## Output section to make responses more deterministic.");
    }

    if (!/maximum response length|token/i.test(markdown)) {
      suggestions.push("Specify max response length/tokens for predictable output size.");
    }

    if (!/example|format/i.test(markdown)) {
      suggestions.push("Include a concrete response example or format template.");
    }

    const score = Math.max(
      0,
      100 - errors.length * 26 - warnings.length * 11 - suggestions.length * 6,
    );

    return { score, errors, warnings, suggestions };
  },
};

/**
 * Resolution point. Today it always returns localAnalyzer. When a model-backed
 * analyzer is added later, the switch happens HERE and nowhere else — page.tsx
 * never imports a specific analyzer.
 */
export function getStaveAnalyzer(): StaveAnalyzer {
  return localAnalyzer;
}
