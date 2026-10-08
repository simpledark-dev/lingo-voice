import { hostActionSchema } from "@/core/room-model";
import { sessionIdSchema } from "@/core/validation";
import { ConfigError, loadServerEnv } from "@/server/env";
import { readHostKey, verifyHostKey } from "@/server/host-auth";
import { apiError, apiJson } from "@/server/http";
import { createLogger, errorFields } from "@/server/logger";
import { createRoomServiceClient, LingoRoomService, RoomNotFoundError } from "@/server/room-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.host");

/**
 * POST /api/rooms/:roomId/host  (header: x-host-key)
 * Body: one of the host actions in core/room-model.ts. Every action is enforced by
 * LiveKit permissions / metadata, so a client without the key cannot do any of this.
 */
export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await context.params;
  if (!sessionIdSchema.safeParse(roomId).success) return apiError(400, "invalid-request", "Invalid room id.");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "invalid-json", "Request body must be JSON.");
  }
  const parsed = hostActionSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "invalid-request", "Invalid host action.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const action = parsed.data;

  let service: LingoRoomService;
  try {
    service = new LingoRoomService(createRoomServiceClient(loadServerEnv()));
  } catch (err) {
    if (err instanceof ConfigError) return apiError(500, "server-misconfigured", "The voice server is not configured.");
    throw err;
  }

  try {
    const found = await service.findRoom(roomId);
    if (!found) return apiError(404, "room-not-found", "This room is not live.");
    if (!(await verifyHostKey(readHostKey(request), found.metadata.hostKeyHash))) {
      log.warn("host.unauthorized", { roomId, action: action.action });
      return apiError(401, "host-key-invalid", "Only the host can do that.");
    }
    if ("identity" in action && action.identity === found.metadata.host.identity) {
      return apiError(400, "invalid-request", "The host cannot target themselves.");
    }

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
    log.info("host.action", { roomId, ...action });
    return apiJson({ ok: true });
  } catch (err) {
    if (err instanceof RoomNotFoundError) return apiError(404, "room-not-found", "This room is not live.");
    log.error("host.action-failed", { roomId, action: action.action, ...errorFields(err) });
    return apiError(502, "livekit-error", "The action could not be applied.");
  }
}
