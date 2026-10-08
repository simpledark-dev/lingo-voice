/**
 * Platform-independent types shared by the backend, the web client and any
 * future native client. No React / DOM / Node specifics in this file.
 */

export const PARTICIPANT_ROLES = ["host", "speaker", "listener"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

/** What a participant is allowed to do inside a session. Derived from the role (and moderation state). */
export interface SessionPermissions {
  /** Publish a microphone track. */
  canPublish: boolean;
  canSubscribe: boolean;
  /** Send data messages (chat, reactions). False when the host muted this user's chat. */
  canPublishData: boolean;
  /** Update own participant attributes (used for raising a hand). */
  canUpdateOwnMetadata: boolean;
}

/** Body of POST /api/token. Sent by any client (web today, native later). */
export interface TokenRequest {
  sessionId: string;
  displayName: string;
  /**
   * Stable per-device/per-tab identity. Optional: the server generates one when
   * missing. Reusing the same identity after a refresh lets the server replace
   * the stale connection instead of showing a duplicate participant.
   */
  identity?: string;
  role?: ParticipantRole;
}

/** Everything a client needs to connect. Never contains the API secret. */
export interface TokenResponse {
  serverUrl: string;
  token: string;
  sessionId: string;
  identity: string;
  displayName: string;
  role: ParticipantRole;
  permissions: SessionPermissions;
  /** ISO-8601 timestamp of token expiry. */
  expiresAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Attribute key used to carry the role to other participants via LiveKit participant attributes. */
export const ROLE_ATTRIBUTE_KEY = "lingo.role";
