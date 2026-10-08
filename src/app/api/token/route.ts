import type { ParticipantRole } from "@/core/types";
import { tokenRequestSchema } from "@/core/validation";
import { ConfigError, loadServerEnv } from "@/server/env";
import { verifyHostKey } from "@/server/host-auth";
import { apiError, apiJson } from "@/server/http";
import { createLogger, errorFields } from "@/server/logger";
import { createRoomServiceClient, LingoRoomService } from "@/server/room-service";
import { createParticipantToken } from "@/server/token-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.token");

/**
 * POST /api/token
 * Body: { sessionId, displayName, identity?, role? }  (see core/types.ts TokenRequest)
 * 200:  TokenResponse
 * 400:  invalid-json | invalid-request
 * 500:  server-misconfigured | token-failed
 *
 * Platform neutral: a native client posts the same JSON.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "invalid-json", "Request body must be JSON.");
  }

  const parsed = tokenRequestSchema.safeParse(json);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    log.warn("token.invalid-request", { requestId, details });
    return apiError(400, "invalid-request", "Invalid token request.", details);
  }

  let env;
  try {
    env = loadServerEnv();
  } catch (err) {
    log.error("token.misconfigured", { requestId, issues: err instanceof ConfigError ? err.issues : String(err) });
    return apiError(
      500,
      "server-misconfigured",
      "The voice server is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.",
    );
  }

  try {
    const { sessionId, displayName, hostKey } = parsed.data;
    let identity = parsed.data.identity;
    let role: ParticipantRole | undefined = parsed.data.role;
    let chatMuted = false;
    let productRoom = false;

    // Product rooms decide the role server-side; plain test sessions (/s/...) keep the requested role.
    const found = await new LingoRoomService(createRoomServiceClient(env)).findRoom(sessionId).catch((err: unknown) => {
      log.warn("token.room-lookup-failed", { requestId, sessionId, ...errorFields(err) });
      return null;
    });
    if (found) {
      productRoom = true;
      const { metadata } = found;
      if (hostKey && (await verifyHostKey(hostKey, metadata.hostKeyHash))) {
        role = "host";
        identity = metadata.host.identity;
      } else if (identity && metadata.stage.includes(identity)) {
        role = "speaker";
      } else {
        role = "listener";
      }
      chatMuted = identity ? metadata.chatMuted.includes(identity) : false;
    }

    const response = await createParticipantToken({ sessionId, displayName, identity, role }, { env, chatMuted });
    log.info("token.issued", {
      requestId,
      sessionId: response.sessionId,
      identity: response.identity,
      role: response.role,
      productRoom,
      chatMuted,
      ttlSeconds: env.LIVEKIT_TOKEN_TTL_SECONDS,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return apiJson(response);
  } catch (err) {
    log.error("token.failed", { requestId, ...errorFields(err) });
    return apiError(500, "token-failed", "Could not create a join token.");
  }
}

export function GET(): Response {
  return apiError(405, "method-not-allowed", "Use POST with a JSON body.");
}
