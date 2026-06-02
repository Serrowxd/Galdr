import { describe, expect, it } from "vitest";

import {
  GRIMOIRE_TABS,
  defaultGrimoireTab,
  isGrimoireTabId,
} from "@/lib/grimoireTabs";

describe("GRIMOIRE_TABS", () => {
  it("lists the five surface tabs in display order", () => {
    expect([...GRIMOIRE_TABS]).toEqual([
      "readme",
      "files",
      "orchestration",
      "discussion",
      "versions",
    ]);
  });
});

describe("isGrimoireTabId", () => {
  it("accepts every known tab id", () => {
    for (const tab of GRIMOIRE_TABS) {
      expect(isGrimoireTabId(tab)).toBe(true);
    }
  });

  it("rejects unknown or retired ids", () => {
    // "staves" was an interim id folded into the Files inspector.
    expect(isGrimoireTabId("staves")).toBe(false);
    expect(isGrimoireTabId("readmes")).toBe(false);
    expect(isGrimoireTabId("")).toBe(false);
  });

  it("rejects a missing value (no `?tab=`)", () => {
    expect(isGrimoireTabId(undefined)).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isGrimoireTabId("Readme")).toBe(false);
    expect(isGrimoireTabId("FILES")).toBe(false);
  });
});

describe("defaultGrimoireTab", () => {
  it("lands on the README when the grimoire ships one", () => {
    expect(defaultGrimoireTab(true)).toBe("readme");
  });

  it("falls back to Files (which opens on STAVES) without a README", () => {
    expect(defaultGrimoireTab(false)).toBe("files");
  });

  it("always returns a valid tab id", () => {
    expect(isGrimoireTabId(defaultGrimoireTab(true))).toBe(true);
    expect(isGrimoireTabId(defaultGrimoireTab(false))).toBe(true);
  });
});
