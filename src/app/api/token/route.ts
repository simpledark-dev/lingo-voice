import { tokenRequestSchema } from "@/core/validation";
import { ConfigError, loadServerEnv } from "@/server/env";
import { apiError, apiJson } from "@/server/http";
import { createLogger, errorFields } from "@/server/logger";
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
    const response = await createParticipantToken(parsed.data, { env });
    log.info("token.issued", {
      requestId,
      sessionId: response.sessionId,
      identity: response.identity,
      role: response.role,
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
