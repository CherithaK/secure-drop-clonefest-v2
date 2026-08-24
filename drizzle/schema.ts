import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const secureDrops = mysqlTable("secure_drops", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 24 }).notNull().unique(),
  ownerSessionHash: varchar("ownerSessionHash", { length: 128 }).notNull(),
  title: varchar("title", { length: 160 }).notNull().default("Untitled drop"),
  ciphertext: text("ciphertext"),
  iv: varchar("iv", { length: 64 }),
  authTag: varchar("authTag", { length: 64 }),
  passphraseHash: varchar("passphraseHash", { length: 256 }),
  status: mysqlEnum("status", ["ACTIVE", "EXPIRED", "REVOKED", "DESTROYED"]).notNull().default("ACTIVE"),
  burnAfterReading: int("burnAfterReading").notNull().default(0),
  viewLimit: int("viewLimit").notNull().default(1),
  viewCount: int("viewCount").notNull().default(0),
  failedAttempts: int("failedAttempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastViewedAt: timestamp("lastViewedAt"),
}, (table) => ({
  ownerSessionIdx: index("secure_drops_owner_session_idx").on(table.ownerSessionHash),
  lifecycleIdx: index("secure_drops_lifecycle_idx").on(table.status, table.expiresAt),
}));

export const secureDropEvents = mysqlTable("secure_drop_events", {
  id: int("id").autoincrement().primaryKey(),
  ownerSessionHash: varchar("ownerSessionHash", { length: 128 }).notNull(),
  dropSlug: varchar("dropSlug", { length: 24 }).notNull(),
  kind: mysqlEnum("kind", ["CREATED", "OPENED", "PASSPHRASE_REJECTED", "REVOKED", "EXPIRED", "DESTROYED"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ownerSessionIdx: index("secure_drop_events_owner_session_idx").on(table.ownerSessionHash, table.createdAt),
  dropIdx: index("secure_drop_events_drop_idx").on(table.dropSlug, table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SecureDrop = typeof secureDrops.$inferSelect;
export type InsertSecureDrop = typeof secureDrops.$inferInsert;
export type SecureDropEvent = typeof secureDropEvents.$inferSelect;
