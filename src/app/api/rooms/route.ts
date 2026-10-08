import { createRoomRequestSchema, type CreateRoomResponse } from "@/core/room-model";
import { createLogger, databaseFailure, livekitFailure, readJson, roomService, zodDetails } from "@/server/api-helpers";
import { getUser } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.rooms");

/** GET /api/rooms — rooms that are live right now. */
export async function GET(): Promise<Response> {
  const svc = roomService();
  if (!svc.ok) return svc.response;
  try {
    return apiJson({ rooms: await svc.service.listRooms() });
  } catch (err) {
    return livekitFailure(log, "rooms.list-failed", err, "Could not list rooms.");
  }
}

/** POST /api/rooms — create a room hosted by the signed-in (guest) account. */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = createRoomRequestSchema.safeParse(body.json);
  if (!parsed.success) return apiError(400, "invalid-request", "Invalid room request.", zodDetails(parsed.error));
  const svc = roomService();
  if (!svc.ok) return svc.response;

  let user;
  try {
    user = await getUser(request);
  } catch (err) {
    return databaseFailure(log, "rooms.auth-failed", err);
  }
  if (!user) return apiError(401, "unauthenticated", "Sign in first.");
  try {
    const room = await svc.service.createRoom(parsed.data, { identity: user.id, name: user.displayName });
    log.info("rooms.created", { roomId: room.id, language: room.language, level: room.level, hostId: user.id });
    const response: CreateRoomResponse = { room };
    return apiJson(response, 201);
  } catch (err) {
    return livekitFailure(log, "rooms.create-failed", err, "Could not create the room.");
  }
}
