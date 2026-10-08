/**
 * Database access: libSQL / SQLite. Locally a file (zero setup); in production a
 * Turso database (DATABASE_URL=libsql://... + DATABASE_AUTH_TOKEN). Same dialect
 * everywhere, so tests run against the real thing.
 */
import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_URL = "file:./data/lingo.db";

let client: Client | null = null;
let clientUrl: string | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || DEFAULT_URL;
}

function ensureDirectoryFor(url: string): void {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  if (filePath === ":memory:" || filePath.startsWith(":memory")) return;
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

export function getDb(): Client {
  const url = databaseUrl();
  if (client && clientUrl === url) return client;
  ensureDirectoryFor(url);
  client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined });
  clientUrl = url;
  schemaReady = null;
  return client;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'guest',
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    last_location TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS users_last_seen ON users(last_seen_at)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    room_title TEXT NOT NULL,
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    responded_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS invites_to ON invites(to_user_id, status, created_at)`,
  `CREATE INDEX IF NOT EXISTS invites_room ON invites(room_id, status, created_at)`,
];

export function ensureSchema(): Promise<void> {
  const db = getDb();
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const statement of SCHEMA) await db.execute(statement);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/** Run a query against a schema-ready database. */
export async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  await ensureSchema();
  return fn(getDb());
}

/** Tests switch DATABASE_URL between cases. */
export function resetDbForTests(): void {
  client?.close();
  client = null;
  clientUrl = null;
  schemaReady = null;
}

export function randomId(prefix: string, length = 16): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `${prefix}-${out}`;
}
