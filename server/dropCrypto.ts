import crypto from "node:crypto";
import { parse as parseCookie } from "cookie";

const COOKIE = "securedrop_creator";
const TTL_SECONDS = 60 * 60 * 24 * 365;
const secret = () => process.env.JWT_SECRET || "securedrop-dev-secret";

export function newCreatorSession() {
  return crypto.randomBytes(32).toString("hex");
}

export function sessionHash(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function getCreatorSession(req: { headers: { cookie?: string } }) {
  const value = parseCookie(req.headers.cookie || "")[COOKIE];
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function attachCreatorCookie(res: { cookie: (name: string, value: string, options: Record<string, unknown>) => void }, value: string) {
  res.cookie(COOKIE, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: TTL_SECONDS });
}

export function encryptSecret(plaintext: string) {
  const key = crypto.createHash("sha256").update(secret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), authTag: cipher.getAuthTag().toString("base64url") };
}

export function decryptSecret(ciphertext: string, iv: string, authTag: string) {
  const key = crypto.createHash("sha256").update(secret()).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function hashPassphrase(value: string) {
  return crypto.scryptSync(value, secret().slice(0, 16), 32).toString("hex");
}

export function verifyPassphrase(value: string, expected: string) {
  const actual = Buffer.from(hashPassphrase(value), "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}

export function makeShareUrl(req: { protocol: string; get: (name: string) => string | undefined }, slug: string) {
  return `${req.protocol}://${req.get("host") || "securedrop.local"}/drop/${slug}`;
}

export { COOKIE };
