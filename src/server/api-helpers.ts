import { ConfigError, loadServerEnv } from "./env";
import { apiError } from "./http";
import { createLogger, errorFields, type Logger } from "./logger";
import { createRoomServiceClient, LingoRoomService } from "./room-service";

export async function readJson(request: Request): Promise<{ ok: true; json: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, json: await request.json() };
  } catch {
    return { ok: false, response: apiError(400, "invalid-json", "Request body must be JSON.") };
  }
}

export function zodDetails(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
}

/** Room service, or a 500 response when LiveKit is not configured. */
export function roomService(): { ok: true; service: LingoRoomService } | { ok: false; response: Response } {
  try {
    return { ok: true, service: new LingoRoomService(createRoomServiceClient(loadServerEnv())) };
  } catch (err) {
    if (err instanceof ConfigError) {
      return { ok: false, response: apiError(500, "server-misconfigured", "The voice server is not configured.") };
    }
    throw err;
  }
}

export function livekitFailure(log: Logger, event: string, err: unknown, message: string, extra: Record<string, unknown> = {}): Response {
  log.error(event, { ...extra, ...errorFields(err) });
  return apiError(502, "livekit-error", message);
}

export function databaseFailure(log: Logger, event: string, err: unknown, extra: Record<string, unknown> = {}): Response {
  log.error(event, { ...extra, ...errorFields(err) });
  return apiError(500, "database-error", "The database is unavailable. Check DATABASE_URL.");
}

export { createLogger };
