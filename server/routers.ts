import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { attachCreatorCookie, decryptSecret, encryptSecret, getCreatorSession, hashPassphrase, makeShareUrl, newCreatorSession, sessionHash, verifyPassphrase } from "./dropCrypto";
import { clearWrongAttempts, getDrop, incrementView, insertDrop, listDropsForSession, markExpired, registerWrongAttempt, revokeDrop } from "./db";

const createInput = z.object({ title: z.string().trim().max(160).optional(), content: z.string().min(1).max(100000), expirationMinutes: z.number().int().min(1).max(525600), viewLimit: z.number().int().min(1).max(100).default(1), passphrase: z.string().min(8).max(200).optional(), burnAfterReading: z.boolean().default(false) });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  drops: router({
    create: publicProcedure.input(createInput).mutation(async ({ input, ctx }) => {
      const creatorSession = getCreatorSession(ctx.req) ?? newCreatorSession();
      const encrypted = encryptSecret(input.content);
      const slug = nanoid(10);
      const expiresAt = new Date(Date.now() + input.expirationMinutes * 60_000);
      const row = await insertDrop({ slug, ownerSessionHash: sessionHash(creatorSession), title: input.title || "Untitled drop", ...encrypted, passphraseHash: input.passphrase ? hashPassphrase(input.passphrase) : null, status: "ACTIVE", burnAfterReading: input.burnAfterReading ? 1 : 0, viewLimit: input.viewLimit, viewCount: 0, failedAttempts: 0, lockedUntil: null, expiresAt });
      attachCreatorCookie(ctx.res, creatorSession);
      return { slug: row!.slug, title: row!.title, expiresAt: row!.expiresAt, viewLimit: row!.viewLimit, burnAfterReading: Boolean(row!.burnAfterReading), protected: Boolean(row!.passphraseHash), url: makeShareUrl(ctx.req, slug) };
    }),
    dashboard: publicProcedure.input(z.object({ search: z.string().max(100).optional(), status: z.enum(["ALL", "ACTIVE", "EXPIRED", "REVOKED", "DESTROYED"]).default("ALL") }).default({ status: "ALL" })).query(async ({ input, ctx }) => {
      const creatorSession = getCreatorSession(ctx.req); if (!creatorSession) return { hasSession: false, cookieClearedWarning: true, drops: [] };
      let drops = await listDropsForSession(sessionHash(creatorSession)); const now = Date.now();
      drops = drops.map((drop) => ({ ...drop, status: drop.status === "ACTIVE" && new Date(drop.expiresAt).getTime() <= now ? "EXPIRED" as const : drop.status, url: makeShareUrl(ctx.req, drop.slug) }));
      if (input.status !== "ALL") drops = drops.filter((drop) => drop.status === input.status);
      if (input.search) { const term = input.search.toLowerCase(); drops = drops.filter((drop) => drop.title.toLowerCase().includes(term) || drop.slug.toLowerCase().includes(term)); }
      return { hasSession: true, cookieClearedWarning: false, drops };
    }),
    access: publicProcedure.input(z.object({ slug: z.string().min(5).max(24), passphrase: z.string().max(200).optional() })).mutation(async ({ input }) => {
      await markExpired(input.slug); const drop = await getDrop(input.slug); if (!drop) throw new TRPCError({ code: "NOT_FOUND", message: "This drop no longer exists." });
      if (drop.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN", message: `This drop is ${drop.status.toLowerCase()}.` });
      if (drop.lockedUntil && new Date(drop.lockedUntil).getTime() > Date.now()) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many incorrect attempts. Try again in 15 minutes." });
      if (drop.passphraseHash && (!input.passphrase || !verifyPassphrase(input.passphrase, drop.passphraseHash))) { const attempts = drop.failedAttempts + 1; await registerWrongAttempt(input.slug, attempts, attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null); throw new TRPCError({ code: attempts >= 5 ? "TOO_MANY_REQUESTS" : "UNAUTHORIZED", message: attempts >= 5 ? "Too many incorrect attempts. Try again in 15 minutes." : "That passphrase is not correct." }); }
      if (!drop.ciphertext || !drop.iv || !drop.authTag) throw new TRPCError({ code: "NOT_FOUND", message: "This drop has already been destroyed." });
      await clearWrongAttempts(input.slug); const secret = decryptSecret(drop.ciphertext, drop.iv, drop.authTag); const shouldDestroy = Boolean(drop.burnAfterReading) || drop.viewCount + 1 >= drop.viewLimit; await incrementView(input.slug, shouldDestroy);
      return { secret, destroyedAfterView: shouldDestroy, title: drop.title };
    }),
    revoke: publicProcedure.input(z.object({ slug: z.string().min(5).max(24) })).mutation(async ({ input, ctx }) => { const creatorSession = getCreatorSession(ctx.req); if (!creatorSession) throw new TRPCError({ code: "UNAUTHORIZED", message: "Creator session not found." }); const ok = await revokeDrop(input.slug, sessionHash(creatorSession)); if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Drop not found or already inactive." }); return { success: true }; }),
  }),
});
export type AppRouter = typeof appRouter;
