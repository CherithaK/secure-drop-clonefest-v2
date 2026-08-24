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
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encryptForShare(plaintext: string) {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  const bytes = new Uint8Array(encrypted);
  const authTag = bytes.slice(-16);
  const ciphertext = bytes.slice(0, -16);
  return { ciphertext: toBase64Url(ciphertext), iv: toBase64Url(iv), authTag: toBase64Url(authTag), fragmentKey: toBase64Url(rawKey) };
}

export async function decryptFromShare(input: { ciphertext: string; iv: string; authTag: string; fragmentKey: string }) {
  const rawKey = fromBase64Url(input.fragmentKey);
  if (rawKey.length !== 32) throw new Error("This link is missing a valid decryption key.");
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const ciphertext = fromBase64Url(input.ciphertext);
  const authTag = fromBase64Url(input.authTag);
  const joined = new Uint8Array(ciphertext.length + authTag.length);
  joined.set(ciphertext);
  joined.set(authTag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(input.iv) }, key, joined);
  return decoder.decode(decrypted);
}

export function fragmentKeyFromLocation() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("k");
}
