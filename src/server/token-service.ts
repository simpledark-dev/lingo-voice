/**
 * Issues LiveKit access tokens. Reusable by any client (web, native) through the
 * HTTP route; also directly callable from other server code.
 */
import { AccessToken, TrackSource } from "livekit-server-sdk";
import { permissionsForRole } from "@/core/permissions";
import { ROLE_ATTRIBUTE_KEY, type ParticipantRole, type TokenRequest, type TokenResponse } from "@/core/types";
import { generateIdentity } from "@/core/validation";
import type { ServerEnv } from "./env";

export interface TokenServiceDeps {
  env: ServerEnv;
  now?: () => Date;
  generateIdentity?: () => string;
}

/** `request` must already be validated with tokenRequestSchema. */
export async function createParticipantToken(request: TokenRequest, deps: TokenServiceDeps): Promise<TokenResponse> {
  const { env } = deps;
  const now = deps.now ? deps.now() : new Date();
  const role: ParticipantRole = request.role ?? env.DEFAULT_PARTICIPANT_ROLE;
  const permissions = permissionsForRole(role);
  const identity = request.identity ?? (deps.generateIdentity ?? generateIdentity)();
  const ttlSeconds = env.LIVEKIT_TOKEN_TTL_SECONDS;

  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name: request.displayName,
    ttl: ttlSeconds,
    attributes: { [ROLE_ATTRIBUTE_KEY]: role },
  });

  token.addGrant({
    room: request.sessionId,
    roomJoin: true,
    canSubscribe: permissions.canSubscribe,
    canPublish: permissions.canPublish,
    // Voice product: even speakers may only publish a microphone, never camera/screen.
    ...(permissions.canPublish ? { canPublishSources: [TrackSource.MICROPHONE] } : {}),
    canPublishData: false,
    canUpdateOwnMetadata: false,
    hidden: false,
  });

  const jwt = await token.toJwt();

  return {
    serverUrl: env.LIVEKIT_URL,
    token: jwt,
    sessionId: request.sessionId,
    identity,
    displayName: request.displayName,
    role,
    permissions,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  };
}
