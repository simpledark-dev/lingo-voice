/**
 * Room management on top of LiveKit's server API. All host powers are enforced
 * here by changing LiveKit permissions / metadata, never by the UI alone.
 */
import {
  RoomServiceClient,
  TrackSource,
  TrackType,
  type ParticipantInfo,
  type ParticipantPermission,
  type Room,
} from "livekit-server-sdk";
import { permissionsForRole } from "@/core/permissions";
import {
  HAND_ATTRIBUTE_KEY,
  parseRoomMetadata,
  ROOM_METADATA_KIND,
  serializeRoomMetadata,
  toRoomDetails,
  toRoomSummary,
  type CreateRoomRequest,
  type Passage,
  type RoomDetails,
  type RoomMetadata,
  type RoomSummary,
} from "@/core/room-model";
import type { ParticipantRole } from "@/core/types";
import { defaultPassage, findPassage, libraryPassage } from "@/core/passages";
import { generateSessionId } from "@/core/validation";
import type { ServerEnv } from "./env";

/** LiveKit's HTTP API lives at the same host as the WebSocket URL. */
export function livekitHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export function createRoomServiceClient(env: ServerEnv): RoomServiceClient {
  return new RoomServiceClient(livekitHttpUrl(env.LIVEKIT_URL), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

/** The subset of RoomServiceClient we use; makes the service testable with a fake. */
export type RoomAdminClient = Pick<
  RoomServiceClient,
  | "createRoom"
  | "listRooms"
  | "deleteRoom"
  | "updateRoomMetadata"
  | "getParticipant"
  | "listParticipants"
  | "removeParticipant"
  | "mutePublishedTrack"
  | "updateParticipant"
>;

/** Full LiveKit permission object for a role. Always send the full object: partial updates reset unset fields. */
export function livekitPermissionFor(role: ParticipantRole, options: { chatMuted?: boolean } = {}): Partial<ParticipantPermission> {
  const p = permissionsForRole(role, options);
  return {
    canSubscribe: p.canSubscribe,
    canPublish: p.canPublish,
    canPublishData: p.canPublishData,
    canPublishSources: p.canPublish ? [TrackSource.MICROPHONE] : [],
    canUpdateMetadata: p.canUpdateOwnMetadata,
    hidden: false,
    recorder: false,
    agent: false,
  };
}

export class RoomNotFoundError extends Error {
  constructor(roomId: string) {
    super(`Room not found: ${roomId}`);
    this.name = "RoomNotFoundError";
  }
}

export interface FoundRoom {
  room: Room;
  metadata: RoomMetadata;
}

const ROOM_EMPTY_TIMEOUT_S = 5 * 60; // host has 5 min to join after creation; room survives brief total absence
const ROOM_DEPARTURE_TIMEOUT_S = 60; // a dropped participant may resume for 60 s
const ROOM_MAX_PARTICIPANTS = 200;

export class LingoRoomService {
  constructor(
    private readonly client: RoomAdminClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listRooms(): Promise<RoomSummary[]> {
    const rooms = await this.client.listRooms();
    const summaries: RoomSummary[] = [];
    for (const room of rooms) {
      const metadata = parseRoomMetadata(room.metadata);
      if (!metadata || metadata.kind !== ROOM_METADATA_KIND) continue;
      summaries.push(toRoomSummary(room.name, metadata, room.numParticipants));
    }
    summaries.sort((a, b) => b.participantCount - a.participantCount || b.createdAt.localeCompare(a.createdAt));
    return summaries;
  }

  async findRoom(roomId: string): Promise<FoundRoom | null> {
    const rooms = await this.client.listRooms([roomId]);
    const room = rooms.find((r) => r.name === roomId);
    if (!room) return null;
    const metadata = parseRoomMetadata(room.metadata);
    return metadata ? { room, metadata } : null;
  }

  async getRoomDetails(roomId: string): Promise<RoomDetails | null> {
    const found = await this.findRoom(roomId);
    return found ? toRoomDetails(roomId, found.metadata, found.room.numParticipants) : null;
  }

  /** A 4-digit number no live room is using (5 digits if the 4-digit space is crowded). */
  private async pickRoomNumber(): Promise<number> {
    const taken = new Set((await this.listRooms()).map((r) => r.number));
    const random = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = random(1000, 9999);
      if (!taken.has(candidate)) return candidate;
    }
    for (;;) {
      const candidate = random(10_000, 99_999);
      if (!taken.has(candidate)) return candidate;
    }
  }

  async createRoom(input: CreateRoomRequest, host: { identity: string; name: string }): Promise<RoomDetails> {
    const number = await this.pickRoomNumber();
    const passage: Passage = input.customPassage
      ? { ...input.customPassage, language: input.language, level: input.level, source: "custom" }
      : (() => {
          const fromLibrary = input.passageId ? findPassage(input.passageId) : undefined;
          return fromLibrary ? libraryPassage(fromLibrary) : defaultPassage(input.language, input.level);
        })();
    const metadata: RoomMetadata = {
      v: 1,
      kind: ROOM_METADATA_KIND,
      title: input.title,
      language: input.language,
      level: input.level,
      number,
      host: { identity: host.identity, name: host.name },
      passage,
      stage: [],
      chatMuted: [],
      createdAt: this.now().toISOString(),
    };
    const roomId = `${input.language}-${generateSessionId()}`;
    const room = await this.client.createRoom({
      name: roomId,
      emptyTimeout: ROOM_EMPTY_TIMEOUT_S,
      departureTimeout: ROOM_DEPARTURE_TIMEOUT_S,
      maxParticipants: ROOM_MAX_PARTICIPANTS,
      metadata: serializeRoomMetadata(metadata),
    });
    return toRoomDetails(room.name, metadata, room.numParticipants);
  }

  private async updateMetadata(roomId: string, mutate: (m: RoomMetadata) => RoomMetadata): Promise<RoomMetadata> {
    const found = await this.findRoom(roomId);
    if (!found) throw new RoomNotFoundError(roomId);
    const next = mutate(found.metadata);
    await this.client.updateRoomMetadata(roomId, serializeRoomMetadata(next));
    return next;
  }

  async setPassage(roomId: string, passage: Passage): Promise<RoomMetadata> {
    return this.updateMetadata(roomId, (m) => ({ ...m, passage }));
  }

  /** Put a listener on stage: grant publish permission, clear their raised hand, record in metadata. */
  async inviteToStage(roomId: string, identity: string): Promise<RoomMetadata> {
    const metadata = await this.updateMetadata(roomId, (m) => ({
      ...m,
      stage: m.stage.includes(identity) ? m.stage : [...m.stage, identity],
    }));
    await this.client.updateParticipant(roomId, identity, {
      permission: livekitPermissionFor("speaker", { chatMuted: metadata.chatMuted.includes(identity) }),
      attributes: { [HAND_ATTRIBUTE_KEY]: "" }, // empty value deletes the attribute
    });
    return metadata;
  }

  /** Back to listener: LiveKit unpublishes their microphone when canPublish is revoked. */
  async removeFromStage(roomId: string, identity: string): Promise<RoomMetadata> {
    const metadata = await this.updateMetadata(roomId, (m) => ({ ...m, stage: m.stage.filter((id) => id !== identity) }));
    await this.client.updateParticipant(roomId, identity, {
      permission: livekitPermissionFor("listener", { chatMuted: metadata.chatMuted.includes(identity) }),
    });
    return metadata;
  }

  async listParticipantIdentities(roomId: string): Promise<string[]> {
    const participants = await this.client.listParticipants(roomId);
    return participants.map((p) => p.identity);
  }

  /** Server-side mute of every audio track the participant publishes. */
  async muteParticipant(roomId: string, identity: string): Promise<number> {
    const info: ParticipantInfo = await this.client.getParticipant(roomId, identity);
    let muted = 0;
    for (const track of info.tracks) {
      if (track.type === TrackType.AUDIO && !track.muted) {
        await this.client.mutePublishedTrack(roomId, identity, track.sid, true);
        muted += 1;
      }
    }
    return muted;
  }

  async removeParticipant(roomId: string, identity: string): Promise<void> {
    await this.updateMetadata(roomId, (m) => ({ ...m, stage: m.stage.filter((id) => id !== identity) }));
    await this.client.removeParticipant(roomId, identity);
  }

  async setChatMuted(roomId: string, identity: string, muted: boolean): Promise<RoomMetadata> {
    const metadata = await this.updateMetadata(roomId, (m) => ({
      ...m,
      chatMuted: muted ? (m.chatMuted.includes(identity) ? m.chatMuted : [...m.chatMuted, identity]) : m.chatMuted.filter((id) => id !== identity),
    }));
    const role: ParticipantRole = metadata.stage.includes(identity) ? "speaker" : "listener";
    await this.client.updateParticipant(roomId, identity, { permission: livekitPermissionFor(role, { chatMuted: muted }) });
    return metadata;
  }

  /** Ends the room for everyone (clients receive ROOM_DELETED). */
  async endRoom(roomId: string): Promise<void> {
    await this.client.deleteRoom(roomId);
  }
}
