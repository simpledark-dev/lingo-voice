/**
 * Session auth for guest accounts: an opaque random token in an httpOnly cookie
 * (or `Authorization: Bearer` for native clients), stored hashed in the sessions
 * table. Email sign-up later attaches to the same user row.
 */
import { randomId, withDb } from "./db";
import { createGuestUser, getUserById, type UserRecord } from "./users";

export const SESSION_COOKIE = "lingo_session";
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function readSessionToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return parseCookies(request.headers.get("cookie"))[SESSION_COOKIE] ?? null;
}

export async function createSession(userId: string, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
  const token = randomId("s", 40);
  const expiresAt = now + SESSION_TTL_MS;
  const tokenHash = await sha256Hex(token);
  await withDb((db) =>
    db.execute({
      sql: "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      args: [tokenHash, userId, now, expiresAt],
    }),
  );
  return { token, expiresAt };
}

export async function getUserForToken(token: string, now = Date.now()): Promise<UserRecord | null> {
  const tokenHash = await sha256Hex(token);
  const result = await withDb((db) =>
    db.execute({ sql: "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?", args: [tokenHash, now] }),
  );
  const row = result.rows[0];
  if (!row) return null;
  return getUserById(String(row.user_id));
}

function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]!.trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookieHeader(token: string, expiresAt: number, request: Request): string {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export interface AuthResult {
  user: UserRecord;
  /** Set-Cookie header value when a new session was created; attach it to the response. */
  setCookie: string | null;
  isNew: boolean;
}

/** The signed-in user, or null. Never creates anything. */
export async function getUser(request: Request): Promise<UserRecord | null> {
  const token = readSessionToken(request);
  return token ? getUserForToken(token) : null;
}

/** The signed-in user, creating a guest account + session when there is none. */
export async function getOrCreateUser(request: Request): Promise<AuthResult> {
  const existing = await getUser(request);
  if (existing) return { user: existing, setCookie: null, isNew: false };
  const user = await createGuestUser();
  const session = await createSession(user.id);
  return { user, setCookie: sessionCookieHeader(session.token, session.expiresAt, request), isNew: true };
}

export function withSetCookie(response: Response, setCookie: string | null): Response {
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}
