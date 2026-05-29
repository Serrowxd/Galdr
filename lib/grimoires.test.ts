import { describe, expect, it } from "vitest";

import { computeFamilyDiff } from "@/lib/grimoires";

// Pure inclusion-event diff used when a new grimoire version is published
// (spec 07 #21). DB-backed behavior (resolution, publish, audit writes) needs a
// test database, which isn't configured yet — see memory galdr-spec-progress.
describe("computeFamilyDiff", () => {
  it("reports added families not present in the predecessor", () => {
    const { added, removed } = computeFamilyDiff(["a", "b"], ["a", "b", "c"]);
    expect(added).toEqual(["c"]);
    expect(removed).toEqual([]);
  });

  it("reports removed families dropped from the predecessor", () => {
    const { added, removed } = computeFamilyDiff(["a", "b", "c"], ["a"]);
    expect(added).toEqual([]);
    expect(removed.sort()).toEqual(["b", "c"]);
  });

  it("reports both added and removed in one diff", () => {
    const { added, removed } = computeFamilyDiff(["a", "b"], ["b", "c"]);
    expect(added).toEqual(["c"]);
    expect(removed).toEqual(["a"]);
  });

  it("emits nothing when the family set is unchanged", () => {
    const { added, removed } = computeFamilyDiff(["a", "b"], ["b", "a"]);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("treats an empty predecessor as all-added (first publish)", () => {
    const { added, removed } = computeFamilyDiff([], ["a", "b"]);
    expect(added).toEqual(["a", "b"]);
    expect(removed).toEqual([]);
  });

  it("dedupes repeated families on either side", () => {
    const { added, removed } = computeFamilyDiff(["a", "a"], ["a", "b", "b"]);
    expect(added).toEqual(["b"]);
    expect(removed).toEqual([]);
  });
});
