import { describe, expect, it } from "vitest";
import {
  createRoomRequestSchema,
  hostActionSchema,
  parseRoomMetadata,
  serializeRoomMetadata,
  stageRoleOf,
  toRoomSummary,
  type RoomMetadata,
} from "./room-model";
import { decodeLiveMessage, encodeLiveMessage } from "./messages";
import { defaultPassage, findPassage, PASSAGE_LIBRARY, passagesFor } from "./passages";

const metadata: RoomMetadata = {
  v: 1,
  kind: "lingo-room",
  title: "English practice",
  language: "en",
  level: "beginner",
  host: { identity: "p-host", name: "Hana" },
  passage: { title: "T", text: "Some text", language: "en", source: "custom" },
  stage: ["p-speaker"],
  chatMuted: [],
  createdAt: "2026-10-08T00:00:00.000Z",
};

describe("room metadata", () => {
  it("round-trips through JSON", () => {
    expect(parseRoomMetadata(serializeRoomMetadata(metadata))).toEqual(metadata);
  });
  it("ignores foreign or malformed metadata", () => {
    expect(parseRoomMetadata("")).toBeNull();
    expect(parseRoomMetadata("not json")).toBeNull();
    expect(parseRoomMetadata(JSON.stringify({ kind: "other" }))).toBeNull();
  });
  it("derives stage roles", () => {
    expect(stageRoleOf("p-host", metadata)).toBe("host");
    expect(stageRoleOf("p-speaker", metadata)).toBe("speaker");
    expect(stageRoleOf("p-x", metadata, true)).toBe("listener"); // metadata is authoritative
    expect(stageRoleOf("p-x", null, true)).toBe("speaker"); // test sessions without metadata
  });
  it("summarises for the lobby", () => {
    const summary = toRoomSummary("en-abcd-efgh", metadata, 3);
    expect(summary.participantCount).toBe(3);
    expect(summary.passageTitle).toBe("T");
    expect(summary.number).toBeGreaterThanOrEqual(1000); // fallback hash for rooms without a number
    expect(toRoomSummary("en-abcd-efgh", { ...metadata, number: 77 }, 1).number).toBe(77);
  });
});

describe("API schemas", () => {
  it("validates create requests", () => {
    expect(createRoomRequestSchema.safeParse({ title: "Hi", language: "en", level: "beginner" }).success).toBe(true);
    expect(createRoomRequestSchema.safeParse({ title: "", language: "en", level: "beginner" }).success).toBe(false);
    expect(createRoomRequestSchema.safeParse({ title: "Hi", language: "xx", level: "beginner" }).success).toBe(false);
  });
  it("validates host actions", () => {
    expect(hostActionSchema.safeParse({ action: "invite", identity: "p-abc" }).success).toBe(true);
    expect(hostActionSchema.safeParse({ action: "end" }).success).toBe(true);
    expect(hostActionSchema.safeParse({ action: "invite" }).success).toBe(false);
    expect(hostActionSchema.safeParse({ action: "nuke" }).success).toBe(false);
  });
});

describe("live messages", () => {
  it("round-trips chat and reactions", () => {
    const chat = { type: "chat" as const, id: "m1", text: "hello", at: 1 };
    expect(decodeLiveMessage(encodeLiveMessage(chat))).toEqual(chat);
    const reaction = { type: "reaction" as const, emoji: "👏" as const };
    expect(decodeLiveMessage(encodeLiveMessage(reaction))).toEqual(reaction);
  });
  it("rejects unknown reactions, oversized text and garbage", () => {
    expect(decodeLiveMessage(new TextEncoder().encode(JSON.stringify({ type: "reaction", emoji: "🔥" })))).toBeNull();
    expect(decodeLiveMessage(new TextEncoder().encode(JSON.stringify({ type: "chat", id: "x", text: "a".repeat(501), at: 1 })))).toBeNull();
    expect(decodeLiveMessage(new TextEncoder().encode("{{"))).toBeNull();
  });
});

describe("passage library", () => {
  it("has one passage per language and level", () => {
    for (const language of ["en", "es", "fr", "de", "vi", "ja", "ko", "zh"] as const) {
      for (const level of ["beginner", "intermediate", "advanced"] as const) {
        expect(passagesFor(language, level).length, `${language}/${level}`).toBe(1);
      }
    }
    expect(new Set(PASSAGE_LIBRARY.map((p) => p.id)).size).toBe(PASSAGE_LIBRARY.length);
  });
  it("falls back sensibly", () => {
    expect(defaultPassage("vi", "advanced").id).toBe("vi-a1");
    expect(findPassage("nope")).toBeUndefined();
  });
});
