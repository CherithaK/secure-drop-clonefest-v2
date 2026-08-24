import { describe, expect, it } from "vitest";
import { decryptFromShare, encryptForShare } from "./fragmentCrypto";

describe("fragment-key encryption", () => {
  it("encrypts a note with a random browser key and decrypts it only with that key", async () => {
    const plaintext = "demo handoff\nnot for the server";
    const encrypted = await encryptForShare(plaintext);

    expect(encrypted.ciphertext).not.toContain("demo handoff");
    expect(encrypted.fragmentKey).toHaveLength(43);
    await expect(decryptFromShare(encrypted)).resolves.toBe(plaintext);
  });

  it("rejects a wrong fragment key", async () => {
    const encrypted = await encryptForShare("sealed note");
    await expect(decryptFromShare({ ...encrypted, fragmentKey: encrypted.fragmentKey.slice(1) + "A" })).rejects.toThrow();
  });
});
