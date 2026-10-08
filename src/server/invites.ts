import type { Row } from "@libsql/client";
import { INVITE_TTL_MS } from "@/core/lobby-model";
import { randomId, withDb } from "./db";

export type InviteStatus = "pending" | "accepted" | "declined";

export interface InviteRecord {
  id: string;
  roomId: string;
  roomTitle: string;
  fromUserId: string;
  toUserId: string;
  status: InviteStatus;
  createdAt: number;
  respondedAt: number | null;
}

function rowToInvite(row: Row): InviteRecord {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    roomTitle: String(row.room_title),
    fromUserId: String(row.from_user_id),
    toUserId: String(row.to_user_id),
    status: row.status as InviteStatus,
    createdAt: Number(row.created_at),
    respondedAt: row.responded_at === null || row.responded_at === undefined ? null : Number(row.responded_at),
  };
}

/** Idempotent: a pending, unexpired invite for the same room and person is reused. */
export async function createInvite(
  input: { roomId: string; roomTitle: string; fromUserId: string; toUserId: string },
  now = Date.now(),
): Promise<InviteRecord> {
  const existing = await withDb((db) =>
    db.execute({
      sql: "SELECT * FROM invites WHERE room_id = ? AND to_user_id = ? AND status = 'pending' AND created_at > ? ORDER BY created_at DESC LIMIT 1",
      args: [input.roomId, input.toUserId, now - INVITE_TTL_MS],
    }),
  );
  if (existing.rows[0]) return rowToInvite(existing.rows[0]);
  const id = randomId("inv");
  await withDb((db) =>
    db.execute({
      sql: "INSERT INTO invites (id, room_id, room_title, from_user_id, to_user_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
      args: [id, input.roomId, input.roomTitle, input.fromUserId, input.toUserId, now],
    }),
  );
  return { id, ...input, status: "pending", createdAt: now, respondedAt: null };
}

export async function listPendingInvitesFor(userId: string, now = Date.now()): Promise<InviteRecord[]> {
  const result = await withDb((db) =>
    db.execute({
      sql: "SELECT * FROM invites WHERE to_user_id = ? AND status = 'pending' AND created_at > ? ORDER BY created_at DESC LIMIT 20",
      args: [userId, now - INVITE_TTL_MS],
    }),
  );
  return result.rows.map(rowToInvite);
}

export async function listPendingInvitesForRoom(roomId: string, now = Date.now()): Promise<InviteRecord[]> {
  const result = await withDb((db) =>
    db.execute({
      sql: "SELECT * FROM invites WHERE room_id = ? AND status = 'pending' AND created_at > ? ORDER BY created_at DESC LIMIT 200",
      args: [roomId, now - INVITE_TTL_MS],
    }),
  );
  return result.rows.map(rowToInvite);
}

/** Only the invitee may respond, and only once. */
export async function respondToInvite(id: string, userId: string, action: "accept" | "decline", now = Date.now()): Promise<InviteRecord | null> {
  const status: InviteStatus = action === "accept" ? "accepted" : "declined";
  await withDb((db) =>
    db.execute({
      sql: "UPDATE invites SET status = ?, responded_at = ? WHERE id = ? AND to_user_id = ? AND status = 'pending'",
      args: [status, now, id, userId],
    }),
  );
  const result = await withDb((db) => db.execute({ sql: "SELECT * FROM invites WHERE id = ? AND to_user_id = ?", args: [id, userId] }));
  const row = result.rows[0];
  return row ? rowToInvite(row) : null;
}
