import { describe, expect, it } from "vitest";

import { slugifyTitle } from "@/lib/staveSlug";

describe("slugifyTitle", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyTitle("Code Reviewer")).toBe("code-reviewer");
  });

  it("folds accents via NFKD", () => {
    expect(slugifyTitle("Café Crawler")).toBe("cafe-crawler");
  });

  it("strips emoji and punctuation", () => {
    expect(slugifyTitle("Deploy 🚀 Warden!!!")).toBe("deploy-warden");
  });

  it("collapses repeated separators and trims edges", () => {
    expect(slugifyTitle("  --Hello   World--  ")).toBe("hello-world");
  });

  it("falls back for purely-punctuation titles", () => {
    expect(slugifyTitle("!!!")).toBe("untitled-stave");
    expect(slugifyTitle("")).toBe("untitled-stave");
  });

  it("caps length at 80 chars", () => {
    const long = "a".repeat(200);
    expect(slugifyTitle(long).length).toBe(80);
  });
});
