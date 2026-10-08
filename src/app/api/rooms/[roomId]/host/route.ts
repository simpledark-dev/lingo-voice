import { hostActionSchema } from "@/core/room-model";
import { sessionIdSchema } from "@/core/validation";
import { createLogger, databaseFailure, readJson, roomService, zodDetails } from "@/server/api-helpers";
import { getUser } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { errorFields } from "@/server/logger";
import { RoomNotFoundError } from "@/server/room-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.host");

/**
 * POST /api/rooms/:roomId/host — moderation. Authorised when the signed-in user is
 * the room's host (their user id is the host identity in the room metadata).
 * Every action is enforced by LiveKit permissions / metadata, never by the UI alone.
 */
export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await context.params;
  if (!sessionIdSchema.safeParse(roomId).success) return apiError(400, "invalid-request", "Invalid room id.");

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = hostActionSchema.safeParse(body.json);
  if (!parsed.success) return apiError(400, "invalid-request", "Invalid host action.", zodDetails(parsed.error));
  const action = parsed.data;

  const svc = roomService();
  if (!svc.ok) return svc.response;

  let user;
  try {
    user = await getUser(request);
  } catch (err) {
    return databaseFailure(log, "host.auth-failed", err);
  }
  if (!user) return apiError(401, "unauthenticated", "Sign in first.");

  try {
    const found = await svc.service.findRoom(roomId);
    if (!found) return apiError(404, "room-not-found", "This room is not live.");
    if (found.metadata.host.identity !== user.id) {
      log.warn("host.forbidden", { roomId, userId: user.id, action: action.action });
      return apiError(403, "not-host", "Only the host can do that.");
    }
    if ("identity" in action && action.identity === found.metadata.host.identity) {
      return apiError(400, "invalid-request", "The host cannot target themselves.");
    }

    const service = svc.service;
    switch (action.action) {
      case "set-passage":
        await service.setPassage(roomId, action.passage);
        break;
      case "invite":
        await service.inviteToStage(roomId, action.identity);
        break;
      case "remove-from-stage":
        await service.removeFromStage(roomId, action.identity);
        break;
      case "mute":
        await service.muteParticipant(roomId, action.identity);
        break;
      case "remove-participant":
        await service.removeParticipant(roomId, action.identity);
        break;
      case "set-chat-muted":
        await service.setChatMuted(roomId, action.identity, action.muted);
        break;
      case "end":
        await service.endRoom(roomId);
        break;
    }
    log.info("host.action", { roomId, userId: user.id, ...action });
    return apiJson({ ok: true });
  } catch (err) {
    if (err instanceof RoomNotFoundError) return apiError(404, "room-not-found", "This room is not live.");
    log.error("host.action-failed", { roomId, action: action.action, ...errorFields(err) });
    return apiError(502, "livekit-error", "The action could not be applied.");
  }
}
