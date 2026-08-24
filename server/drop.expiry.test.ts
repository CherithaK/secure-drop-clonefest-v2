import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));
const insertValues = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => fakeDb }));

import { markExpired } from "./db";

describe("expiry audit transition", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test";
    vi.clearAllMocks();
    fakeDb.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ ownerSessionHash: "owner-hash" }] }) }) });
    fakeDb.update.mockReturnValue({ set: () => ({ where: async () => undefined }) });
    insertValues.mockResolvedValue(undefined);
    fakeDb.insert.mockReturnValue({ values: insertValues });
  });

  it("records EXPIRED when an active expired row crosses the lifecycle boundary", async () => {
    await expect(markExpired("past-due-drop")).resolves.toBe(true);

    expect(fakeDb.update).toHaveBeenCalledTimes(1);
    expect(fakeDb.insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith({ ownerSessionHash: "owner-hash", dropSlug: "past-due-drop", kind: "EXPIRED" });
  });
});
