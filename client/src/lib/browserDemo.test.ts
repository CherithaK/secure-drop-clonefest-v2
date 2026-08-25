import { describe, expect, it } from "vitest";
import { browserDemoPayloadFromLocation, createBrowserDemoUrl } from "./browserDemo";

describe("database-free browser demo links", () => {
  it("encodes ciphertext-only demo metadata into a URL fragment", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", { value: { location: { origin: "https://secure-drop-clonefest-v3.vercel.app", hash: "" } }, configurable: true });
    const url = createBrowserDemoUrl({ v: 1, title: "Safe demo", ciphertext: "cipher", iv: "iv", authTag: "tag", burnAfterReading: true, expiresAt: 1234, fragmentKey: "browser-key" });
    expect(url).toContain("/drop/browser-demo#k=browser-key&d=");
    (globalThis.window as unknown as { location: { hash: string } }).location.hash = url.slice(url.indexOf("#"));
    expect(browserDemoPayloadFromLocation()).toMatchObject({ title: "Safe demo", ciphertext: "cipher", burnAfterReading: true });
    Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
  });
});
