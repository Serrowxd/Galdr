/** Baseline tags offered as quick-pick toggles in the Loom publish fold-out.
 *  These are suggestions, not an allowlist — the validator (lib/staveValidation)
 *  caps count (10) and length (32) but accepts any string. Keep each value short
 *  and lowercase so the registry tag filter stays tidy. */
export const BASELINE_TAGS = [
  "coding",
  "review",
  "writing",
  "research",
  "data",
  "analysis",
  "moderation",
  "summarization",
  "translation",
  "devops",
  "security",
  "testing",
  "support",
  "creative",
  "productivity",
  "automation",
] as const;
