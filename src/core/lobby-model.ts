/** Accounts, presence and invites: shapes shared by the API and every client. */
import { z } from "zod";
import type { RoomSummary } from "./room-model";
import { displayNameSchema, identitySchema, sessionIdSchema } from "./validation";

export type UserKind = "guest" | "email";

export interface PublicUser {
  id: string;
  displayName: string;
  kind: UserKind;
}

export type UserLocation = { kind: "lobby" } | { kind: "room"; roomId: string; roomTitle: string | null };

export interface OnlineUser {
  id: string;
  displayName: string;
  isMe: boolean;
  location: UserLocation;
}

export interface InviteView {
  id: string;
  roomId: string;
  roomTitle: string;
  from: { id: string; displayName: string };
  createdAt: string;
}

export interface LobbyResponse {
  me: PublicUser;
  rooms: RoomSummary[];
  roomsError: string | null;
  online: OnlineUser[];
  onlineCount: number;
  invites: InviteView[];
}

/** Someone in the lobby a host can invite. */
export interface LobbyPerson {
  id: string;
  displayName: string;
  invitedAt: string | null;
}

/** A user counts as online when a heartbeat arrived within this window. */
export const ONLINE_WINDOW_MS = 60_000;
/** Invites disappear from the lobby after this long. */
export const INVITE_TTL_MS = 2 * 60_000;

export const updateMeSchema = z.object({ displayName: displayNameSchema });
export const presenceSchema = z.object({ location: z.union([z.literal("lobby"), sessionIdSchema]) });
export const createInviteSchema = z.object({ toUserId: identitySchema });
export const inviteResponseSchema = z.object({ action: z.enum(["accept", "decline"]) });
