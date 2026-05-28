import { describe, expect, it } from "vitest";

import { validateStaveFields } from "@/lib/staveValidation";

const base = { title: "My Stave", body: "# Body" };

describe("validateStaveFields", () => {
  it("accepts a minimal valid payload", () => {
    const r = validateStaveFields(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.license).toBe("CC BY 4.0");
      expect(r.value.tags).toEqual([]);
      expect(r.value.description).toBeNull();
    }
  });

  it("requires a non-empty title", () => {
    expect(validateStaveFields({ ...base, title: "  " }).ok).toBe(false);
    expect(validateStaveFields({ body: "x" }).ok).toBe(false);
  });

  it("requires a non-empty body", () => {
    expect(validateStaveFields({ title: "x" }).ok).toBe(false);
  });

  it("rejects an over-long title", () => {
    expect(validateStaveFields({ ...base, title: "a".repeat(201) }).ok).toBe(false);
  });

  it("rejects more than 10 tags", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `t${i}`);
    expect(validateStaveFields({ ...base, tags }).ok).toBe(false);
  });

  it("rejects a tag longer than 32 chars", () => {
    expect(validateStaveFields({ ...base, tags: ["a".repeat(33)] }).ok).toBe(false);
  });

  it("rejects an unknown license", () => {
    expect(validateStaveFields({ ...base, license: "WTFPL" }).ok).toBe(false);
  });

  it("accepts allowed licenses", () => {
    for (const license of ["CC BY 4.0", "CC0", "MIT", "ARR"]) {
      expect(validateStaveFields({ ...base, license }).ok).toBe(true);
    }
  });

  it("rejects a body over 1 MB", () => {
    expect(validateStaveFields({ ...base, body: "x".repeat(1_048_577) }).ok).toBe(
      false,
    );
  });
});
