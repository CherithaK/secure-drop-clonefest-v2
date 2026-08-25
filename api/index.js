// server/vercel.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, index } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var secureDrops = mysqlTable("secure_drops", {
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
  lastViewedAt: timestamp("lastViewedAt")
}, (table) => ({
  ownerSessionIdx: index("secure_drops_owner_session_idx").on(table.ownerSessionHash),
  lifecycleIdx: index("secure_drops_lifecycle_idx").on(table.status, table.expiresAt)
}));
var secureDropEvents = mysqlTable("secure_drop_events", {
  id: int("id").autoincrement().primaryKey(),
  ownerSessionHash: varchar("ownerSessionHash", { length: 128 }).notNull(),
  dropSlug: varchar("dropSlug", { length: 24 }).notNull(),
  kind: mysqlEnum("kind", ["CREATED", "OPENED", "PASSPHRASE_REJECTED", "REVOKED", "EXPIRED", "DESTROYED"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({
  ownerSessionIdx: index("secure_drop_events_owner_session_idx").on(table.ownerSessionHash, table.createdAt),
  dropIdx: index("secure_drop_events_drop_idx").on(table.dropSlug, table.createdAt)
}));

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db.ts
var _db = null;
function databaseErrorMetadata(error) {
  const record = error && typeof error === "object" ? error : {};
  const cause = record.cause && typeof record.cause === "object" ? record.cause : record;
  return {
    code: typeof cause.code === "string" || typeof cause.code === "number" ? cause.code : null,
    errno: typeof cause.errno === "number" ? cause.errno : null,
    sqlState: typeof cause.sqlState === "string" ? cause.sqlState : null,
    name: typeof cause.name === "string" ? cause.name : "DatabaseError"
  };
}
function databaseDiagnosticCode(error) {
  const code = databaseErrorMetadata(error).code;
  const normalized = code === null ? "" : String(code).toUpperCase();
  return /^[A-Z0-9_]{2,64}$/.test(normalized) ? normalized : "WRITE_FAILED";
}
function createTiDbCloudPool(databaseUrl) {
  const url = new URL(databaseUrl);
  return mysql.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 4e3,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: true }
  });
}
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      const hostname = new URL(databaseUrl).hostname;
      _db = hostname.endsWith(".tidbcloud.com") ? drizzle({ client: createTiDbCloudPool(databaseUrl) }) : drizzle(databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to initialize:", databaseErrorMetadata(error));
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date(), role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user") };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name ?? null, email: values.email ?? null, loginMethod: values.loginMethod ?? null, lastSignedIn: values.lastSignedIn, role: values.role } });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}
async function insertDrop(input) {
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
async function listDropsForSession(ownerSessionHash) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: secureDrops.id, slug: secureDrops.slug, title: secureDrops.title, status: secureDrops.status, burnAfterReading: secureDrops.burnAfterReading, viewLimit: secureDrops.viewLimit, viewCount: secureDrops.viewCount, expiresAt: secureDrops.expiresAt, createdAt: secureDrops.createdAt, lastViewedAt: secureDrops.lastViewedAt }).from(secureDrops).where(eq(secureDrops.ownerSessionHash, ownerSessionHash));
}
async function getDrop(slug) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(secureDrops).where(eq(secureDrops.slug, slug)).limit(1);
  return rows[0];
}
async function logDropEvent(ownerSessionHash, dropSlug, kind) {
  const db = await getDb();
  if (!db) return;
  await db.insert(secureDropEvents).values({ ownerSessionHash, dropSlug, kind });
}
async function listDropEvents(ownerSessionHash) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(secureDropEvents).where(eq(secureDropEvents.ownerSessionHash, ownerSessionHash)).orderBy(desc(secureDropEvents.createdAt)).limit(18);
}
async function markExpired(slug) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ ownerSessionHash: secureDrops.ownerSessionHash }).from(secureDrops).where(and(eq(secureDrops.slug, slug), eq(secureDrops.status, "ACTIVE"), lt(secureDrops.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
  if (!rows[0]) return false;
  await db.update(secureDrops).set({ status: "EXPIRED" }).where(and(eq(secureDrops.slug, slug), eq(secureDrops.status, "ACTIVE")));
  await db.insert(secureDropEvents).values({ ownerSessionHash: rows[0].ownerSessionHash, dropSlug: slug, kind: "EXPIRED" });
  return true;
}
async function reconcileExpiredForSession(ownerSessionHash) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ slug: secureDrops.slug }).from(secureDrops).where(and(eq(secureDrops.ownerSessionHash, ownerSessionHash), eq(secureDrops.status, "ACTIVE"), lt(secureDrops.expiresAt, /* @__PURE__ */ new Date())));
  for (const row of rows) await markExpired(row.slug);
  return rows.length;
}
async function registerWrongAttempt(slug, failedAttempts, lockedUntil) {
  const db = await getDb();
  if (!db) return;
  await db.update(secureDrops).set({ failedAttempts, lockedUntil }).where(eq(secureDrops.slug, slug));
}
async function clearWrongAttempts(slug) {
  const db = await getDb();
  if (!db) return;
  await db.update(secureDrops).set({ failedAttempts: 0, lockedUntil: null }).where(eq(secureDrops.slug, slug));
}
async function incrementView(slug, destroy) {
  const db = await getDb();
  if (!db) return;
  if (destroy) await db.update(secureDrops).set({ ciphertext: null, iv: null, authTag: null, status: "DESTROYED", viewCount: sql`${secureDrops.viewCount} + 1`, lastViewedAt: /* @__PURE__ */ new Date() }).where(and(eq(secureDrops.slug, slug), eq(secureDrops.status, "ACTIVE")));
  else await db.update(secureDrops).set({ viewCount: sql`${secureDrops.viewCount} + 1`, lastViewedAt: /* @__PURE__ */ new Date() }).where(eq(secureDrops.slug, slug));
}
async function revokeDrop(slug, ownerSessionHash) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(secureDrops).set({ ciphertext: null, iv: null, authTag: null, status: "REVOKED" }).where(and(eq(secureDrops.slug, slug), eq(secureDrops.ownerSessionHash, ownerSessionHash), eq(secureDrops.status, "ACTIVE")));
  return result[0]?.affectedRows > 0;
}
async function pruneDrops() {
  const db = await getDb();
  if (!db) return 0;
  const expired = await db.select({ slug: secureDrops.slug }).from(secureDrops).where(and(eq(secureDrops.status, "ACTIVE"), lt(secureDrops.expiresAt, /* @__PURE__ */ new Date())));
  for (const row of expired) await markExpired(row.slug);
  const result = await db.delete(secureDrops).where(sql`${secureDrops.status} IN ('EXPIRED','DESTROYED','REVOKED')`);
  return result[0]?.affectedRows ?? 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret2 = ENV.cookieSecret;
    return new TextEncoder().encode(secret2);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { nanoid } from "nanoid";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/dropCrypto.ts
import crypto from "node:crypto";
import { parse as parseCookie } from "cookie";
var COOKIE = "securedrop_creator";
var TTL_SECONDS = 60 * 60 * 24 * 365;
var secret = () => process.env.JWT_SECRET || "securedrop-dev-secret";
function newCreatorSession() {
  return crypto.randomBytes(32).toString("hex");
}
function sessionHash(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}
function getCreatorSession(req) {
  const value = parseCookie(req.headers.cookie || "")[COOKIE];
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function attachCreatorCookie(res, value) {
  res.cookie(COOKIE, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: TTL_SECONDS });
}
function hashPassphrase(value) {
  return crypto.scryptSync(value, secret().slice(0, 16), 32).toString("hex");
}
function verifyPassphrase(value, expected) {
  const actual = Buffer.from(hashPassphrase(value), "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}
function makeShareUrl(req, slug) {
  return `${req.protocol}://${req.get("host") || "securedrop.local"}/drop/${slug}`;
}

// server/routers.ts
var createInput = z2.object({ title: z2.string().trim().max(160).optional(), ciphertext: z2.string().min(1).max(25e4), iv: z2.string().min(8).max(64), authTag: z2.string().min(8).max(64), expirationMinutes: z2.number().int().min(1).max(525600), viewLimit: z2.number().int().min(1).max(100).default(1), passphrase: z2.string().min(8).max(200).optional(), burnAfterReading: z2.boolean().default(false) });
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  drops: router({
    create: publicProcedure.input(createInput).mutation(async ({ input, ctx }) => {
      const creatorSession = getCreatorSession(ctx.req) ?? newCreatorSession();
      const ownerSessionHash = sessionHash(creatorSession);
      const slug = nanoid(10);
      const expiresAt = new Date(Date.now() + input.expirationMinutes * 6e4);
      let row;
      try {
        row = await insertDrop({ slug, ownerSessionHash, title: input.title || "Untitled drop", ciphertext: input.ciphertext, iv: input.iv, authTag: input.authTag, passphraseHash: input.passphrase ? hashPassphrase(input.passphrase) : null, status: "ACTIVE", burnAfterReading: input.burnAfterReading ? 1 : 0, viewLimit: input.viewLimit, viewCount: 0, failedAttempts: 0, lockedUntil: null, expiresAt });
        await logDropEvent(ownerSessionHash, slug, "CREATED");
      } catch (error) {
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: `SecureDrop could not save this drop. Please retry shortly. Diagnostic: ${databaseDiagnosticCode(error)}` });
      }
      attachCreatorCookie(ctx.res, creatorSession);
      return { slug: row.slug, title: row.title, expiresAt: row.expiresAt, viewLimit: row.viewLimit, burnAfterReading: Boolean(row.burnAfterReading), protected: Boolean(row.passphraseHash), url: makeShareUrl(ctx.req, slug) };
    }),
    dashboard: publicProcedure.input(z2.object({ search: z2.string().max(100).optional(), status: z2.enum(["ALL", "ACTIVE", "EXPIRED", "REVOKED", "DESTROYED"]).default("ALL") }).default({ status: "ALL" })).query(async ({ input, ctx }) => {
      const creatorSession = getCreatorSession(ctx.req);
      if (!creatorSession) return { hasSession: false, cookieClearedWarning: true, drops: [] };
      const ownerSessionHash = sessionHash(creatorSession);
      await reconcileExpiredForSession(ownerSessionHash);
      let drops = await listDropsForSession(ownerSessionHash);
      const events = await listDropEvents(ownerSessionHash);
      const now = Date.now();
      drops = drops.map((drop) => ({ ...drop, status: drop.status === "ACTIVE" && new Date(drop.expiresAt).getTime() <= now ? "EXPIRED" : drop.status, url: makeShareUrl(ctx.req, drop.slug) }));
      if (input.status !== "ALL") drops = drops.filter((drop) => drop.status === input.status);
      if (input.search) {
        const term = input.search.toLowerCase();
        drops = drops.filter((drop) => drop.title.toLowerCase().includes(term) || drop.slug.toLowerCase().includes(term));
      }
      return { hasSession: true, cookieClearedWarning: false, drops, events };
    }),
    access: publicProcedure.input(z2.object({ slug: z2.string().min(5).max(24), passphrase: z2.string().max(200).optional() })).mutation(async ({ input }) => {
      await markExpired(input.slug);
      const drop = await getDrop(input.slug);
      if (!drop) throw new TRPCError3({ code: "NOT_FOUND", message: "This drop no longer exists." });
      if (drop.status !== "ACTIVE") throw new TRPCError3({ code: "FORBIDDEN", message: `This drop is ${drop.status.toLowerCase()}.` });
      if (drop.lockedUntil && new Date(drop.lockedUntil).getTime() > Date.now()) throw new TRPCError3({ code: "TOO_MANY_REQUESTS", message: "Too many incorrect attempts. Try again in 15 minutes." });
      if (drop.passphraseHash && (!input.passphrase || !verifyPassphrase(input.passphrase, drop.passphraseHash))) {
        const attempts = drop.failedAttempts + 1;
        await registerWrongAttempt(input.slug, attempts, attempts >= 5 ? new Date(Date.now() + 15 * 6e4) : null);
        await logDropEvent(drop.ownerSessionHash, input.slug, "PASSPHRASE_REJECTED");
        throw new TRPCError3({ code: attempts >= 5 ? "TOO_MANY_REQUESTS" : "UNAUTHORIZED", message: attempts >= 5 ? "Too many incorrect attempts. Try again in 15 minutes." : "That passphrase is not correct." });
      }
      if (!drop.ciphertext || !drop.iv || !drop.authTag) throw new TRPCError3({ code: "NOT_FOUND", message: "This drop has already been destroyed." });
      await clearWrongAttempts(input.slug);
      const shouldDestroy = Boolean(drop.burnAfterReading) || drop.viewCount + 1 >= drop.viewLimit;
      await incrementView(input.slug, shouldDestroy);
      await logDropEvent(drop.ownerSessionHash, input.slug, "OPENED");
      if (shouldDestroy) await logDropEvent(drop.ownerSessionHash, input.slug, "DESTROYED");
      return { ciphertext: drop.ciphertext, iv: drop.iv, authTag: drop.authTag, destroyedAfterView: shouldDestroy, title: drop.title };
    }),
    revoke: publicProcedure.input(z2.object({ slug: z2.string().min(5).max(24) })).mutation(async ({ input, ctx }) => {
      const creatorSession = getCreatorSession(ctx.req);
      if (!creatorSession) throw new TRPCError3({ code: "UNAUTHORIZED", message: "Creator session not found." });
      const ownerSessionHash = sessionHash(creatorSession);
      const ok = await revokeDrop(input.slug, ownerSessionHash);
      if (!ok) throw new TRPCError3({ code: "NOT_FOUND", message: "Drop not found or already inactive." });
      await logDropEvent(ownerSessionHash, input.slug, "REVOKED");
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/vercel.ts
function createVercelApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.post("/api/scheduled/cleanup", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) return res.status(403).json({ error: "cron-only" });
      return res.json({ ok: true, deleted: await pruneDrops() });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// scripts/vercel-entry.ts
var vercel_entry_default = createVercelApp();
export {
  vercel_entry_default as default
};
