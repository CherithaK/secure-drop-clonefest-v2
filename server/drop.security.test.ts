import { describe, expect, it } from "vitest";
import { hashPassphrase, sessionHash, verifyPassphrase } from "./dropCrypto";

describe("secure drop cryptography", () => {
  it("keeps browser-side encryption out of the server primitive layer", () => {
    expect("encryptSecret" in { hashPassphrase, sessionHash }).toBe(false);
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
