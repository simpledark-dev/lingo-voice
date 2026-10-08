import { sessionIdSchema } from "@/core/validation";
import { ConfigError, loadServerEnv } from "@/server/env";
import { apiError, apiJson } from "@/server/http";
import { createLogger, errorFields } from "@/server/logger";
import { createRoomServiceClient, LingoRoomService } from "@/server/room-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.room");

/** GET /api/rooms/:roomId — details for the join screen. 404 when the room is not live. */
export async function GET(_request: Request, context: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await context.params;
  if (!sessionIdSchema.safeParse(roomId).success) return apiError(400, "invalid-request", "Invalid room id.");
  try {
    const details = await new LingoRoomService(createRoomServiceClient(loadServerEnv())).getRoomDetails(roomId);
    if (!details) return apiError(404, "room-not-found", "This room is not live.");
    return apiJson({ room: details });
  } catch (err) {
    if (err instanceof ConfigError) return apiError(500, "server-misconfigured", "The voice server is not configured.");
    log.error("room.get-failed", { roomId, ...errorFields(err) });
    return apiError(502, "livekit-error", "Could not load the room.");
  }
}
