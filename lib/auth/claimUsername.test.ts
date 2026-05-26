import { describe, expect, it, vi } from "vitest";
import { claimUsername } from "@/lib/auth/claimUsername";
import type { GaldrDb } from "@/db";

/**
 * Minimal fake of the Drizzle chain used by claimUsername:
 *   db.select(..).from(..).where(..).limit(1)  -> resolves to conflict rows
 *   db.insert(..).values(..).onConflictDoUpdate(..) -> resolves
 */
function makeFakeDb(opts: { conflict: boolean }) {
  const insertValues = vi.fn(() => ({ onConflictDoUpdate: vi.fn(async () => undefined) }));
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (opts.conflict ? [{ userId: "other-user" }] : []),
        }),
      }),
    }),
    insert: () => ({ values: insertValues }),
  };
  return { db: db as unknown as GaldrDb, insertValues };
}

describe("claimUsername", () => {
  it("rejects an invalid username without touching the DB", async () => {
    const { db, insertValues } = makeFakeDb({ conflict: false });
    const res = await claimUsername(db, "user-1", "ab"); // too short
    expect(res).toMatchObject({ ok: false, reason: "invalid" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("reports a collision when the name is taken by someone else", async () => {
    const { db, insertValues } = makeFakeDb({ conflict: true });
    const res = await claimUsername(db, "user-1", "Bragi");
    expect(res).toEqual({ ok: false, reason: "collision" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("upserts and returns ok when the name is free", async () => {
    const { db, insertValues } = makeFakeDb({ conflict: false });
    const res = await claimUsername(db, "user-1", "  Bragi  ");
    expect(res).toEqual({ ok: true, username: "Bragi" });
    expect(insertValues).toHaveBeenCalledWith({ userId: "user-1", username: "Bragi" });
  });
});
