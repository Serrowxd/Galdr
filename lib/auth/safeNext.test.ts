import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safeNext";

describe("safeNext", () => {
  it("passes through a simple rooted path", () => {
    expect(safeNext("/library")).toBe("/library");
    expect(safeNext("/saga/abc")).toBe("/saga/abc");
  });

  it("preserves query strings on a rooted path", () => {
    expect(safeNext("/reset-password?next=/")).toBe("/reset-password?next=/");
  });

  it("falls back to / for null/empty", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("rejects protocol-relative and absolute URLs (open redirect)", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("http://evil.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("rejects backslash tricks", () => {
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("/foo\\bar")).toBe("/");
  });

  it("rejects paths not starting with a single slash", () => {
    expect(safeNext("evil.com")).toBe("/");
    expect(safeNext("../etc")).toBe("/");
  });

  it("rejects ASCII control characters", () => {
    expect(safeNext("/foo\nbar")).toBe("/");
    expect(safeNext("/foo\tbar")).toBe("/");
    expect(safeNext("/foo\x7fbar")).toBe("/");
  });
});
