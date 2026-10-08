import { TrackSource, TrackType } from "livekit-server-sdk";
import { describe, expect, it, vi } from "vitest";
import { HAND_ATTRIBUTE_KEY, parseRoomMetadata, serializeRoomMetadata, type RoomMetadata } from "@/core/room-model";
import { LingoRoomService, livekitHttpUrl, livekitPermissionFor, type RoomAdminClient } from "./room-service";

function fakeClient(rooms: Array<{ name: string; metadata: string; numParticipants: number }>) {
  const state = { rooms };
  const client = {
    createRoom: vi.fn(async (opts: { name: string; metadata?: string }) => {
      state.rooms.push({ name: opts.name, metadata: opts.metadata ?? "", numParticipants: 0 });
      return { name: opts.name, metadata: opts.metadata ?? "", numParticipants: 0 } as never;
    }),
    listRooms: vi.fn(async (names?: string[]) =>
      (names ? state.rooms.filter((r) => names.includes(r.name)) : state.rooms) as never,
    ),
    deleteRoom: vi.fn(async () => undefined),
    updateRoomMetadata: vi.fn(async (name: string, metadata: string) => {
      const r = state.rooms.find((x) => x.name === name)!;
      r.metadata = metadata;
      return r as never;
    }),
    getParticipant: vi.fn(async () => ({
      tracks: [
        { sid: "TR_a", type: TrackType.AUDIO, muted: false },
        { sid: "TR_b", type: TrackType.AUDIO, muted: true },
      ],
    }) as never),
    removeParticipant: vi.fn(async () => undefined),
    mutePublishedTrack: vi.fn(async () => ({}) as never),
    updateParticipant: vi.fn(async () => ({}) as never),
  } satisfies RoomAdminClient;
  return { client, state };
}

const base: RoomMetadata = {
  v: 1,
  kind: "lingo-room",
  title: "Room",
  language: "en",
  level: "beginner",
  host: { identity: "p-host", name: "Host" },
  passage: null,
  stage: [],
  chatMuted: [],
  createdAt: "2026-10-08T00:00:00.000Z",
};

describe("livekitPermissionFor", () => {
  it("always sends the full permission object", () => {
    const speaker = livekitPermissionFor("speaker");
    expect(speaker).toMatchObject({ canSubscribe: true, canPublish: true, canPublishData: true, canUpdateMetadata: true, hidden: false });
    expect(speaker.canPublishSources).toEqual([TrackSource.MICROPHONE]);
    const mutedListener = livekitPermissionFor("listener", { chatMuted: true });
    expect(mutedListener).toMatchObject({ canSubscribe: true, canPublish: false, canPublishData: false, canUpdateMetadata: true });
    expect(mutedListener.canPublishSources).toEqual([]);
  });
  it("maps websocket URLs to the HTTP API", () => {
    expect(livekitHttpUrl("wss://x.livekit.cloud")).toBe("https://x.livekit.cloud");
    expect(livekitHttpUrl("ws://127.0.0.1:7880")).toBe("http://127.0.0.1:7880");
  });
});

describe("LingoRoomService", () => {
  it("lists only lingo rooms, busiest first", async () => {
    const { client } = fakeClient([
      { name: "test-session", metadata: "", numParticipants: 2 },
      { name: "en-a", metadata: serializeRoomMetadata({ ...base, title: "A" }), numParticipants: 1 },
      { name: "en-b", metadata: serializeRoomMetadata({ ...base, title: "B" }), numParticipants: 5 },
    ]);
    const rooms = await new LingoRoomService(client).listRooms();
    expect(rooms.map((r) => r.title)).toEqual(["B", "A"]);
  });

  it("creates a room with a default passage, hosted by the given account", async () => {
    const { client, state } = fakeClient([]);
    const service = new LingoRoomService(client, () => new Date("2026-10-08T00:00:00Z"));
    const details = await service.createRoom({ title: "Hola", language: "es", level: "intermediate" }, { identity: "u-ana", name: "Ana" });
    expect(details.id.startsWith("es-")).toBe(true);
    expect(details.passage?.id).toBe("es-i1");
    expect(details.host).toEqual({ identity: "u-ana", name: "Ana" });
    const stored = parseRoomMetadata(state.rooms[0]!.metadata)!;
    expect(stored.host.identity).toBe("u-ana");
    expect(client.createRoom).toHaveBeenCalledWith(expect.objectContaining({ emptyTimeout: 300, maxParticipants: 200 }));
  });

  it("invites with speaker permission, clears the hand and records the stage", async () => {
    const { client, state } = fakeClient([{ name: "en-a", metadata: serializeRoomMetadata(base), numParticipants: 2 }]);
    const metadata = await new LingoRoomService(client).inviteToStage("en-a", "p-learner");
    expect(metadata.stage).toEqual(["p-learner"]);
    expect(parseRoomMetadata(state.rooms[0]!.metadata)!.stage).toEqual(["p-learner"]);
    expect(client.updateParticipant).toHaveBeenCalledWith("en-a", "p-learner", {
      permission: livekitPermissionFor("speaker"),
      attributes: { [HAND_ATTRIBUTE_KEY]: "" },
    });
  });

  it("removes from stage with listener permission", async () => {
    const { client } = fakeClient([{ name: "en-a", metadata: serializeRoomMetadata({ ...base, stage: ["p-learner"] }), numParticipants: 2 }]);
    const metadata = await new LingoRoomService(client).removeFromStage("en-a", "p-learner");
    expect(metadata.stage).toEqual([]);
    expect(client.updateParticipant).toHaveBeenCalledWith("en-a", "p-learner", { permission: livekitPermissionFor("listener") });
  });

  it("chat mute keeps the stage role but drops data permission", async () => {
    const { client } = fakeClient([{ name: "en-a", metadata: serializeRoomMetadata({ ...base, stage: ["p-learner"] }), numParticipants: 2 }]);
    const metadata = await new LingoRoomService(client).setChatMuted("en-a", "p-learner", true);
    expect(metadata.chatMuted).toEqual(["p-learner"]);
    expect(client.updateParticipant).toHaveBeenCalledWith("en-a", "p-learner", {
      permission: livekitPermissionFor("speaker", { chatMuted: true }),
    });
  });

  it("mutes only unmuted audio tracks", async () => {
    const { client } = fakeClient([{ name: "en-a", metadata: serializeRoomMetadata(base), numParticipants: 2 }]);
    const count = await new LingoRoomService(client).muteParticipant("en-a", "p-learner");
    expect(count).toBe(1);
    expect(client.mutePublishedTrack).toHaveBeenCalledWith("en-a", "p-learner", "TR_a", true);
  });

  it("ends the room by deleting it", async () => {
    const { client } = fakeClient([{ name: "en-a", metadata: serializeRoomMetadata(base), numParticipants: 2 }]);
    await new LingoRoomService(client).endRoom("en-a");
    expect(client.deleteRoom).toHaveBeenCalledWith("en-a");
  });
});
