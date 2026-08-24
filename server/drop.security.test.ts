import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassphrase, sessionHash, verifyPassphrase } from "./dropCrypto";

describe("secure drop cryptography", () => {
  it("round-trips plaintext only through authenticated encryption", () => {
    const encrypted = encryptSecret("sensitive handoff\nline two");
    expect(encrypted.ciphertext).not.toContain("sensitive");
    expect(decryptSecret(encrypted.ciphertext, encrypted.iv, encrypted.authTag)).toBe("sensitive handoff\nline two");
  });
  it("verifies passphrases with a stable one-way hash", () => {
    const digest = hashPassphrase("correct horse battery staple");
    expect(verifyPassphrase("correct horse battery staple", digest)).toBe(true);
    expect(verifyPassphrase("wrong phrase", digest)).toBe(false);
  });
  it("creates deterministic, non-plaintext session ownership keys", () => {
    expect(sessionHash("browser-session")).toBe(sessionHash("browser-session"));
    expect(sessionHash("browser-session")).not.toContain("browser-session");
  });
});
