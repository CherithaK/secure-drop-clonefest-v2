import { and, desc, eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertSecureDrop, InsertUser, secureDropEvents, secureDrops, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

function databaseErrorMetadata(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = record.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : record;

  return {
    code: typeof cause.code === "string" || typeof cause.code === "number" ? cause.code : null,
    errno: typeof cause.errno === "number" ? cause.errno : null,
    sqlState: typeof cause.sqlState === "string" ? cause.sqlState : null,
    name: typeof cause.name === "string" ? cause.name : "DatabaseError",
  };
}
export async function getDb() { if (!_db && process.env.DATABASE_URL) { try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); } } return _db; }
export async function upsertUser(user: InsertUser): Promise<void> { if (!user.openId) throw new Error("User openId is required for upsert"); const db = await getDb(); if (!db) return; const values: InsertUser = { openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: user.lastSignedIn ?? new Date(), role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") }; await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name ?? null, email: values.email ?? null, loginMethod: values.loginMethod ?? null, lastSignedIn: values.lastSignedIn, role: values.role } }); }
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return rows[0]; }
export async function insertDrop(input: InsertSecureDrop) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  try {
    await db.insert(secureDrops).values(input);
    const rows = await db.select().from(secureDrops).where(eq(secureDrops.slug, input.slug)).limit(1);
    return rows[0];
  } catch (error) {
    console.error("[SecureDrop] Drop insert failed", databaseErrorMetadata(error));
    throw error;
  }
}
export async function listDropsForSession(ownerSessionHash: string) { const db = await getDb(); if (!db) return []; return db.select({ id: secureDrops.id, slug: secureDrops.slug, title: secureDrops.title, status: secureDrops.status, burnAfterReading: secureDrops.burnAfterReading, viewLimit: secureDrops.viewLimit, viewCount: secureDrops.viewCount, expiresAt: secureDrops.expiresAt, createdAt: secureDrops.createdAt, lastViewedAt: secureDrops.lastViewedAt }).from(secureDrops).where(eq(secureDrops.ownerSessionHash, ownerSessionHash)); }
export async function getDrop(slug: string) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(secureDrops).where(eq(secureDrops.slug, slug)).limit(1); return rows[0]; }
export async function logDropEvent(ownerSessionHash: string, dropSlug: string, kind: "CREATED" | "OPENED" | "PASSPHRASE_REJECTED" | "REVOKED" | "EXPIRED" | "DESTROYED") { const db = await getDb(); if (!db) return; await db.insert(secureDropEvents).values({ ownerSessionHash, dropSlug, kind }); }
export async function listDropEvents(ownerSessionHash: string) { const db = await getDb(); if (!db) return []; return db.select().from(secureDropEvents).where(eq(secureDropEvents.ownerSessionHash, ownerSessionHash)).orderBy(desc(secureDropEvents.createdAt)).limit(18); }
export async function markExpired(slug: string) { const db = await getDb(); if (!db) return false; const rows = await db.select({ ownerSessionHash: secureDrops.ownerSessionHash }).from(secureDrops).where(and(eq(secureDrops.slug, slug), eq(secureDrops.status, "ACTIVE"), lt(secureDrops.expiresAt, new Date()))).limit(1); if (!rows[0]) return false; await db.update(secureDrops).set({ status: "EXPIRED" }).where(and(eq(secureDrops.slug, slug), eq(secureDrops.status, "ACTIVE"))); await db.insert(secureDropEvents).values({ ownerSessionHash: rows[0].ownerSessionHash, dropSlug: slug, kind: "EXPIRED" }); return true; }
export async function reconcileExpiredForSession(ownerSessionHash: string) { const db = await getDb(); if (!db) return 0; const rows = await db.select({ slug: secureDrops.slug }).from(secureDrops).where(and(eq(secureDrops.ownerSessionHash, ownerSessionHash), eq(secureDrops.status, "ACTIVE"), lt(secureDrops.expiresAt, new Date()))); for (const row of rows) await markExpired(row.slug); return rows.length; }
export async function registerWrongAttempt(slug: string, failedAttempts: number, lockedUntil: Date | null) { const db = await getDb(); if (!db) return; await db.update(secureDrops).set({ failedAttempts, lockedUntil }).where(eq(secureDrops.slug, slug)); }
export async function clearWrongAttempts(slug: string) { const db = await getDb(); if (!db) return; await db.update(secureDrops).set({ failedAttempts: 0, lockedUntil: null }).where(eq(secureDrops.slug, slug)); }
export async function incrementView(slug: string, destroy: boolean) { const db = await getDb(); if (!db) return; if (destroy) await db.update(secureDrops).set({ ciphertext: null, iv: null, authTag: null, status: "DESTROYED", viewCount: sql`${secureDrops.viewCount} + 1`, lastViewedAt: new Date() }).where(and(eq(secureDrops.slug, slug), eq(secureDrops.status, "ACTIVE"))); else await db.update(secureDrops).set({ viewCount: sql`${secureDrops.viewCount} + 1`, lastViewedAt: new Date() }).where(eq(secureDrops.slug, slug)); }
export async function revokeDrop(slug: string, ownerSessionHash: string) { const db = await getDb(); if (!db) return false; const result = await db.update(secureDrops).set({ ciphertext: null, iv: null, authTag: null, status: "REVOKED" }).where(and(eq(secureDrops.slug, slug), eq(secureDrops.ownerSessionHash, ownerSessionHash), eq(secureDrops.status, "ACTIVE"))); return result[0]?.affectedRows > 0; }
export async function pruneDrops() { const db = await getDb(); if (!db) return 0; const expired = await db.select({ slug: secureDrops.slug }).from(secureDrops).where(and(eq(secureDrops.status, "ACTIVE"), lt(secureDrops.expiresAt, new Date()))); for (const row of expired) await markExpired(row.slug); const result = await db.delete(secureDrops).where(sql`${secureDrops.status} IN ('EXPIRED','DESTROYED','REVOKED')`); return result[0]?.affectedRows ?? 0; }
