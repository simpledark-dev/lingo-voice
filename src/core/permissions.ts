import type { ParticipantRole, SessionPermissions } from "./types";

/**
 * Single source of truth for what each role may do. The token service and the
 * room service turn this into LiveKit grants / participant permissions; clients
 * use it to decide which controls to show.
 *
 * host     - speaks, moderates through the host API
 * speaker  - speaks (invited on stage)
 * listener - listens, chats, reacts, raises a hand
 */
export function permissionsForRole(role: ParticipantRole, options: { chatMuted?: boolean } = {}): SessionPermissions {
  const base: SessionPermissions = {
    canPublish: role === "host" || role === "speaker",
    canSubscribe: true,
    canPublishData: !options.chatMuted,
    canUpdateOwnMetadata: true,
  };
  return base;
}
