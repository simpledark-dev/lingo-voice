import type { ParticipantRole, SessionPermissions } from "./types";

/**
 * Single source of truth for what each role may do. The token service turns this
 * into LiveKit grants; clients use it to decide which controls to show.
 *
 * host     - speaks; later: moderates (mute others, promote listeners)
 * speaker  - speaks
 * listener - listens only (cannot publish any track)
 */
export function permissionsForRole(role: ParticipantRole): SessionPermissions {
  switch (role) {
    case "host":
    case "speaker":
      return { canPublish: true, canSubscribe: true };
    case "listener":
      return { canPublish: false, canSubscribe: true };
  }
}
