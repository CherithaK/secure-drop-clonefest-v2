import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  clearWrongAttempts: vi.fn(),
  getDrop: vi.fn(),
  incrementView: vi.fn(),
  insertDrop: vi.fn(),
  listDropEvents: vi.fn(),
  listDropsForSession: vi.fn(),
  logDropEvent: vi.fn(),
  markExpired: vi.fn(),
  reconcileExpiredForSession: vi.fn(),
  registerWrongAttempt: vi.fn(),
  revokeDrop: vi.fn(),
}));

vi.mock("./db", () => db);

import { appRouter } from "./routers";

function contextWithCreatorCookie(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: { cookie: "securedrop_creator=" + "a".repeat(64) }, get: () => "example.test" } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("drop audit reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.listDropsForSession.mockResolvedValue([]);
    db.listDropEvents.mockResolvedValue([{ id: 1, dropSlug: "expired-demo", kind: "EXPIRED", createdAt: new Date("2026-08-24T00:00:00Z"), ownerSessionHash: "hash" }]);
  });

  it("reconciles expiry before returning the owner event timeline", async () => {
    const result = await appRouter.createCaller(contextWithCreatorCookie()).drops.dashboard({ status: "ALL" });

    expect(db.reconcileExpiredForSession).toHaveBeenCalledTimes(1);
    expect(result.events[0]).toMatchObject({ dropSlug: "expired-demo", kind: "EXPIRED" });
  });
});
