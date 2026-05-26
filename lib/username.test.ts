import { describe, expect, it } from "vitest";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  ensureValidSuggestionShape,
  fallbackUsernameSuggestion,
  normalizeEmailLocalPartToSuggestion,
  validateUsernameInput,
  withRandomCollisionSuffix,
} from "@/lib/username";

describe("validateUsernameInput", () => {
  it("accepts letters, digits, underscores, and hyphens", () => {
    expect(validateUsernameInput("scribe_name-x")).toMatchObject({ ok: true });
    expect(validateUsernameInput("Odin")).toEqual({ ok: true, value: "Odin" });
    expect(validateUsernameInput("rún_skald")).toMatchObject({ ok: true });
    expect(validateUsernameInput("user123")).toMatchObject({ ok: true });
    expect(validateUsernameInput("4odin")).toMatchObject({ ok: true });
  });

  it("trims surrounding whitespace", () => {
    expect(validateUsernameInput("  Loki  ")).toEqual({ ok: true, value: "Loki" });
  });

  it("rejects empty input", () => {
    expect(validateUsernameInput("   ")).toMatchObject({ ok: false });
  });

  it("rejects too short / too long", () => {
    expect(validateUsernameInput("ab")).toMatchObject({ ok: false });
    expect(validateUsernameInput("a".repeat(USERNAME_MAX_LENGTH + 1))).toMatchObject({ ok: false });
  });

  it("rejects disallowed characters", () => {
    expect(validateUsernameInput("bad name")).toMatchObject({ ok: false });
    expect(validateUsernameInput("dots.here")).toMatchObject({ ok: false });
    expect(validateUsernameInput("emoji😀name")).toMatchObject({ ok: false });
  });
});

describe("username suggestion helpers", () => {
  it("normalizes an email local-part to allowed chars only", () => {
    expect(normalizeEmailLocalPartToSuggestion("john.doe42")).toBe("johndoe42");
  });

  it("fallback suggestion is valid", () => {
    const s = fallbackUsernameSuggestion();
    expect(validateUsernameInput(s)).toMatchObject({ ok: true });
    expect(s.startsWith("scribe-")).toBe(true);
  });

  it("ensureValidSuggestionShape repairs too-short input", () => {
    const repaired = ensureValidSuggestionShape("a");
    expect(repaired.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
    expect(validateUsernameInput(repaired)).toMatchObject({ ok: true });
  });

  it("collision suffix keeps the result valid and bounded", () => {
    const out = withRandomCollisionSuffix("Freyja");
    expect(out.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
    expect(validateUsernameInput(out)).toMatchObject({ ok: true });
  });
});
