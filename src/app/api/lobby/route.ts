import type { InviteView, LobbyResponse, OnlineUser } from "@/core/lobby-model";
import type { RoomSummary } from "@/core/room-model";
import { createLogger, databaseFailure, roomService } from "@/server/api-helpers";
import { getOrCreateUser, withSetCookie } from "@/server/auth";
import { apiJson } from "@/server/http";
import { errorFields } from "@/server/logger";
import { listPendingInvitesFor } from "@/server/invites";
import { getUsersByIds, listOnlineUsers, toPublicUser, touchPresence } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.lobby");

/**
 * GET /api/lobby — one call does everything the lobby needs and doubles as the
 * caller's presence heartbeat: live rooms, who is online (and where), pending invites.
 */
export async function GET(request: Request): Promise<Response> {
  let auth;
  try {
    auth = await getOrCreateUser(request);
    await touchPresence(auth.user.id, "lobby");
  } catch (err) {
    return databaseFailure(log, "lobby.auth-failed", err);
  }
  const { user, setCookie } = auth;

  let rooms: RoomSummary[] = [];
  let roomsError: string | null = null;
  const svc = roomService();
  if (!svc.ok) {
    roomsError = "The voice server is not configured.";
  } else {
    try {
      rooms = await svc.service.listRooms();
    } catch (err) {
      log.error("lobby.rooms-failed", errorFields(err));
      roomsError = "Could not load live rooms.";
    }
  }
  const roomTitles = new Map(rooms.map((r) => [r.id, r.title]));

  try {
    const now = Date.now();
    const onlineUsers = await listOnlineUsers(now);
    const online: OnlineUser[] = onlineUsers.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      isMe: u.id === user.id,
      location:
        u.lastLocation && u.lastLocation !== "lobby"
          ? { kind: "room", roomId: u.lastLocation, roomTitle: roomTitles.get(u.lastLocation) ?? null }
          : { kind: "lobby" },
    }));
    online.sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.displayName.localeCompare(b.displayName));

    const pending = await listPendingInvitesFor(user.id, now);
    const liveIds = new Set(rooms.map((r) => r.id));
    const stillLive = pending.filter((i) => liveIds.has(i.roomId) || rooms.length === 0);
    const senders = await getUsersByIds(stillLive.map((i) => i.fromUserId));
    const invites: InviteView[] = stillLive.map((i) => ({
      id: i.id,
      roomId: i.roomId,
      roomTitle: roomTitles.get(i.roomId) ?? i.roomTitle,
      from: { id: i.fromUserId, displayName: senders.get(i.fromUserId)?.displayName ?? "Someone" },
      createdAt: new Date(i.createdAt).toISOString(),
    }));

    const body: LobbyResponse = { me: toPublicUser(user), rooms, roomsError, online, onlineCount: online.length, invites };
    return withSetCookie(apiJson(body), setCookie);
  } catch (err) {
    return databaseFailure(log, "lobby.failed", err);
  }
}
