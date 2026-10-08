import type { LobbyPerson } from "@/core/lobby-model";
import { sessionIdSchema } from "@/core/validation";
import { createLogger, databaseFailure, livekitFailure, roomService } from "@/server/api-helpers";
import { getUser } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { listPendingInvitesForRoom } from "@/server/invites";
import { listOnlineUsers } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.lobby-people");

/** GET /api/rooms/:id/lobby-people — host only: people currently in the lobby, with pending-invite state. */
export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await context.params;
  if (!sessionIdSchema.safeParse(roomId).success) return apiError(400, "invalid-request", "Invalid room id.");
  const svc = roomService();
  if (!svc.ok) return svc.response;

  try {
    const user = await getUser(request);
    if (!user) return apiError(401, "unauthenticated", "Sign in first.");
    let found;
    try {
      found = await svc.service.findRoom(roomId);
    } catch (err) {
      return livekitFailure(log, "lobby-people.room-lookup-failed", err, "Could not load the room.", { roomId });
    }
    if (!found) return apiError(404, "room-not-found", "This room is not live.");
    if (found.metadata.host.identity !== user.id) return apiError(403, "not-host", "Only the host can see this.");

    const now = Date.now();
    const [online, pending] = await Promise.all([listOnlineUsers(now), listPendingInvitesForRoom(roomId, now)]);
    const invitedAt = new Map(pending.map((i) => [i.toUserId, new Date(i.createdAt).toISOString()]));
    const people: LobbyPerson[] = online
      .filter((u) => u.id !== user.id && (u.lastLocation === "lobby" || u.lastLocation === null))
      .map((u) => ({ id: u.id, displayName: u.displayName, invitedAt: invitedAt.get(u.id) ?? null }));
    return apiJson({ people });
  } catch (err) {
    return databaseFailure(log, "lobby-people.failed", err, { roomId });
  }
}
