export type BrowserDemoPayload = {
  v: 1;
  id: string;
  title: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  burnAfterReading: boolean;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function isDatabaseFreeVercelDemo() {
  return typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");
}

export function createBrowserDemoUrl(input: BrowserDemoPayload & { fragmentKey: string }) {
  if (typeof window === "undefined") return "";
  const { fragmentKey, ...payload } = input;
  const params = new URLSearchParams({
    k: fragmentKey,
    d: toBase64Url(encoder.encode(JSON.stringify(payload))),
  });
  return `${window.location.origin}/drop/browser-demo#${params.toString()}`;
}

export function browserDemoPayloadFromLocation(): BrowserDemoPayload | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("d");
  if (!value) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(value))) as BrowserDemoPayload;
    if (payload.v !== 1 || !payload.id || !payload.ciphertext || !payload.iv || !payload.authTag || !payload.title) return null;
    return payload;
  } catch {
    return null;
  }
}

export function browserDemoConsumptionKey(linkId: string) {
  return `securedrop:browser-demo-consumed:${linkId}`;
}
