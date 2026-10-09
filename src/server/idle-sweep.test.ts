import { describe, expect, it, vi } from "vitest";
import { serializeRoomMetadata, type RoomMetadata } from "@/core/room-model";
import { maybeSweepIdle, resetSweepThrottleForTests, sweepIdleParticipants } from "./idle-sweep";
import { roomIdleDisconnectMs } from "./idle";
import { LingoRoomService, type RoomAdminClient } from "./room-service";
import type { UserRecord } from "./users";

const metadata: RoomMetadata = {
  v: 1,
  kind: "lingo-room",
  title: "Room",
  language: "en",
  level: "beginner",
  host: { identity: "u-host", name: "Host" },
  passage: null,
  stage: [],
  chatMuted: [],
  createdAt: "2026-10-09T00:00:00.000Z",
};

function user(id: string, lastSeenAt: number | null, lastLocation: string | null): UserRecord {
  return { id, kind: "guest", displayName: id, email: null, createdAt: 0, lastSeenAt, lastLocation };
}

function fake(participants: string[]) {
  const client = {
    createRoom: vi.fn(),
    listRooms: vi.fn(async () => [{ name: "en-room", metadata: serializeRoomMetadata(metadata), numParticipants: participants.length }] as never),
    deleteRoom: vi.fn(),
    updateRoomMetadata: vi.fn(async () => ({}) as never),
    getParticipant: vi.fn(),
    listParticipants: vi.fn(async () => participants.map((identity) => ({ identity })) as never),
    removeParticipant: vi.fn(async () => undefined),
    mutePublishedTrack: vi.fn(),
    updateParticipant: vi.fn(),
  } satisfies RoomAdminClient;
  return client;
}

describe("idle sweep", () => {
  it("removes only participants whose room heartbeat went stale", async () => {
    const client = fake(["u-host", "u-away", "u-fresh", "u-lobby", "p-diag"]);
    const now = 1_000_000;
    const users = new Map<string, UserRecord>([
      ["u-host", user("u-host", now - 5_000, "en-room")],
      ["u-away", user("u-away", now - 11 * 60_000, "en-room")],
      ["u-fresh", user("u-fresh", now - 30_000, "en-room")],
      ["u-lobby", user("u-lobby", now - 11 * 60_000, "lobby")], // stale but last seen elsewhere: leave the SDK's own timeout to it
    ]);
    const result = await sweepIdleParticipants(new LingoRoomService(client), {
      idleMs: 10 * 60_000,
      now,
      getUsersByIds: async () => users,
    });
    expect(result.removed).toEqual([{ roomId: "en-room", identity: "u-away" }]);
    expect(client.removeParticipant).toHaveBeenCalledTimes(1);
    expect(client.removeParticipant).toHaveBeenCalledWith("en-room", "u-away");
  });

  it("is throttled per interval", async () => {
    resetSweepThrottleForTests();
    const client = fake([]);
    const deps = { idleMs: 1_000, now: 50_000, getUsersByIds: async () => new Map<string, UserRecord>() };
    expect(await maybeSweepIdle(new LingoRoomService(client), deps)).not.toBeNull();
    expect(await maybeSweepIdle(new LingoRoomService(client), { ...deps, now: 60_000 })).toBeNull();
    expect(await maybeSweepIdle(new LingoRoomService(client), { ...deps, now: 120_000 })).not.toBeNull();
  });

  it("reads the idle limit from the environment with a sane default", () => {
    expect(roomIdleDisconnectMs({})).toBe(600_000);
    expect(roomIdleDisconnectMs({ ROOM_IDLE_DISCONNECT_MS: "5000" })).toBe(5_000);
    expect(roomIdleDisconnectMs({ ROOM_IDLE_DISCONNECT_MS: "nope" })).toBe(600_000);
    expect(roomIdleDisconnectMs({ ROOM_IDLE_DISCONNECT_MS: "10" })).toBe(600_000);
  });
});
