import { describe, expect, it } from "vitest";

import { slugifyGrimoireTitle } from "@/lib/grimoireSlug";

describe("slugifyGrimoireTitle", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyGrimoireTitle("Full Stack Review")).toBe("full-stack-review");
  });

  it("folds accents via NFKD", () => {
    expect(slugifyGrimoireTitle("Café Pipeline")).toBe("cafe-pipeline");
  });

  it("strips emoji and punctuation", () => {
    expect(slugifyGrimoireTitle("Ship 🚀 It!!!")).toBe("ship-it");
  });

  it("collapses separators and trims edges", () => {
    expect(slugifyGrimoireTitle("  --Hello   World--  ")).toBe("hello-world");
  });

  it("falls back for empty/punctuation titles", () => {
    expect(slugifyGrimoireTitle("!!!")).toBe("untitled-grimoire");
    expect(slugifyGrimoireTitle("")).toBe("untitled-grimoire");
  });

  it("caps length at 80 chars", () => {
    expect(slugifyGrimoireTitle("a".repeat(200)).length).toBe(80);
  });
});
