/**
 * Host authority without accounts: a random key is issued when a room is created,
 * only its SHA-256 hash is stored in the room metadata, and host actions must
 * present the key. Replace with real authentication later.
 */
const subtle = globalThis.crypto.subtle;

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function generateHostKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function hashHostKey(key: string): Promise<string> {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Buffer.from(digest).toString("hex");
}

export async function verifyHostKey(key: string | undefined | null, expectedHash: string): Promise<boolean> {
  if (!key) return false;
  const actual = await hashHostKey(key);
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

export const HOST_KEY_HEADER = "x-host-key";

export function readHostKey(request: Request): string | null {
  const value = request.headers.get(HOST_KEY_HEADER);
  return value && value.trim() ? value.trim() : null;
}
