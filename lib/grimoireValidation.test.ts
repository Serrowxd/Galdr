import { describe, expect, it } from "vitest";

import { validateGrimoireFields } from "@/lib/grimoireValidation";

describe("validateGrimoireFields", () => {
  it("accepts a minimal valid grimoire and defaults the license", () => {
    const result = validateGrimoireFields({ title: "My Grimoire" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("My Grimoire");
      expect(result.value.license).toBe("CC BY 4.0");
      expect(result.value.tags).toEqual([]);
      expect(result.value.shortDescription).toBeNull();
      expect(result.value.details).toBeNull();
    }
  });

  it("requires a non-empty title", () => {
    expect(validateGrimoireFields({ title: "   " }).ok).toBe(false);
    expect(validateGrimoireFields({}).ok).toBe(false);
  });

  it("rejects an over-length title", () => {
    expect(validateGrimoireFields({ title: "a".repeat(201) }).ok).toBe(false);
  });

  it("rejects an over-length short_description", () => {
    const r = validateGrimoireFields({ title: "ok", short_description: "a".repeat(501) });
    expect(r.ok).toBe(false);
  });

  it("rejects details past 20000 chars", () => {
    const r = validateGrimoireFields({ title: "ok", details: "a".repeat(20001) });
    expect(r.ok).toBe(false);
  });

  it("rejects more than 10 tags and over-long tags", () => {
    expect(
      validateGrimoireFields({ title: "ok", tags: Array(11).fill("x") }).ok,
    ).toBe(false);
    expect(
      validateGrimoireFields({ title: "ok", tags: ["a".repeat(33)] }).ok,
    ).toBe(false);
  });

  it("rejects an invalid license", () => {
    expect(validateGrimoireFields({ title: "ok", license: "WTFPL" }).ok).toBe(false);
  });

  it("accepts the orchestration tag like any other tag", () => {
    const r = validateGrimoireFields({ title: "ok", tags: ["orchestration", "ci"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.tags).toContain("orchestration");
  });
});
