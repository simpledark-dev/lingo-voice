import { createRoomRequestSchema, type CreateRoomResponse } from "@/core/room-model";
import { ConfigError, loadServerEnv } from "@/server/env";
import { apiError, apiJson } from "@/server/http";
import { createLogger, errorFields } from "@/server/logger";
import { createRoomServiceClient, LingoRoomService } from "@/server/room-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.rooms");

function service(): LingoRoomService {
  return new LingoRoomService(createRoomServiceClient(loadServerEnv()));
}

function misconfigured(err: unknown): Response | null {
  if (err instanceof ConfigError) {
    log.error("rooms.misconfigured", { issues: err.issues });
    return apiError(500, "server-misconfigured", "The voice server is not configured.");
  }
  return null;
}

/** GET /api/rooms — rooms that are live right now. */
export async function GET(): Promise<Response> {
  try {
    const rooms = await service().listRooms();
    return apiJson({ rooms });
  } catch (err) {
    return misconfigured(err) ?? (log.error("rooms.list-failed", errorFields(err)), apiError(502, "livekit-error", "Could not list rooms."));
  }
}

/** POST /api/rooms — create a room; the response carries the host key exactly once. */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "invalid-json", "Request body must be JSON.");
  }
  const parsed = createRoomRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "invalid-request", "Invalid room request.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  try {
    const { details, hostKey, hostIdentity } = await service().createRoom(parsed.data);
    log.info("rooms.created", { roomId: details.id, language: details.language, level: details.level, hostIdentity });
    const body: CreateRoomResponse = { room: details, hostKey, hostIdentity };
    return apiJson(body, 201);
  } catch (err) {
    return misconfigured(err) ?? (log.error("rooms.create-failed", errorFields(err)), apiError(502, "livekit-error", "Could not create the room."));
  }
}
