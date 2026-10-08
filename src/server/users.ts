import type { Row } from "@libsql/client";
import { generateGuestName } from "@/core/guest-names";
import { ONLINE_WINDOW_MS, type PublicUser, type UserKind } from "@/core/lobby-model";
import { randomId, withDb } from "./db";

export interface UserRecord {
  id: string;
  kind: UserKind;
  displayName: string;
  email: string | null;
  createdAt: number;
  lastSeenAt: number | null;
  lastLocation: string | null;
}

function rowToUser(row: Row): UserRecord {
  return {
    id: String(row.id),
    kind: (row.kind as UserKind) ?? "guest",
    displayName: String(row.display_name),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    createdAt: Number(row.created_at),
    lastSeenAt: row.last_seen_at === null || row.last_seen_at === undefined ? null : Number(row.last_seen_at),
    lastLocation: row.last_location === null || row.last_location === undefined ? null : String(row.last_location),
  };
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, displayName: user.displayName, kind: user.kind };
}

/** New guest account. The id doubles as the LiveKit identity, so it must match identitySchema. */
export async function createGuestUser(displayName = generateGuestName(), now = Date.now()): Promise<UserRecord> {
  const id = randomId("u");
  await withDb((db) =>
    db.execute({
      sql: "INSERT INTO users (id, kind, display_name, created_at, last_seen_at) VALUES (?, 'guest', ?, ?, ?)",
      args: [id, displayName, now, now],
    }),
  );
  return { id, kind: "guest", displayName, email: null, createdAt: now, lastSeenAt: now, lastLocation: null };
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const result = await withDb((db) => db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] }));
  const row = result.rows[0];
  return row ? rowToUser(row) : null;
}

export async function updateDisplayName(id: string, displayName: string): Promise<UserRecord | null> {
  await withDb((db) => db.execute({ sql: "UPDATE users SET display_name = ? WHERE id = ?", args: [displayName, id] }));
  return getUserById(id);
}

/** Presence heartbeat: where the user is right now ("lobby" or a room id). */
export async function touchPresence(id: string, location: string, now = Date.now()): Promise<void> {
  await withDb((db) =>
    db.execute({ sql: "UPDATE users SET last_seen_at = ?, last_location = ? WHERE id = ?", args: [now, location, id] }),
  );
}

export async function listOnlineUsers(now = Date.now(), windowMs = ONLINE_WINDOW_MS): Promise<UserRecord[]> {
  const result = await withDb((db) =>
    db.execute({
      sql: "SELECT * FROM users WHERE last_seen_at IS NOT NULL AND last_seen_at > ? ORDER BY display_name COLLATE NOCASE ASC LIMIT 500",
      args: [now - windowMs],
    }),
  );
  return result.rows.map(rowToUser);
}

export async function getUsersByIds(ids: string[]): Promise<Map<string, UserRecord>> {
  const map = new Map<string, UserRecord>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const result = await withDb((db) => db.execute({ sql: `SELECT * FROM users WHERE id IN (${placeholders})`, args: ids }));
  for (const row of result.rows) {
    const user = rowToUser(row);
    map.set(user.id, user);
  }
  return map;
}
