import { TokenVerifier } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { ROLE_ATTRIBUTE_KEY } from "@/core/types";
import { tokenRequestSchema } from "@/core/validation";
import type { ServerEnv } from "./env";
import { createParticipantToken } from "./token-service";

const env: ServerEnv = {
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "APItestkey",
  LIVEKIT_API_SECRET: "supersecretsupersecretsupersecret",
  LIVEKIT_TOKEN_TTL_SECONDS: 3600,
  DEFAULT_PARTICIPANT_ROLE: "speaker",
};

const verifier = new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

describe("createParticipantToken", () => {
  it("issues a token scoped to the session with speaker grants", async () => {
    const res = await createParticipantToken(
      { sessionId: "test-room", displayName: "Alice", identity: "p-alice", role: "speaker" },
      { env, now: () => new Date("2026-10-08T00:00:00Z") },
    );
    expect(res.serverUrl).toBe(env.LIVEKIT_URL);
    expect(res.identity).toBe("p-alice");
    expect(res.role).toBe("speaker");
    expect(res.permissions).toEqual({ canPublish: true, canSubscribe: true });
    expect(res.expiresAt).toBe("2026-10-08T01:00:00.000Z");

    const claims = await verifier.verify(res.token);
    expect(claims.video?.room).toBe("test-room");
    expect(claims.video?.roomJoin).toBe(true);
    expect(claims.video?.canPublish).toBe(true);
    expect(claims.video?.canSubscribe).toBe(true);
    expect(claims.video?.canPublishData).toBe(false);
    expect(claims.video?.canUpdateOwnMetadata).toBe(false);
    expect(claims.video?.roomAdmin).toBeUndefined();
    expect(claims.name).toBe("Alice");
    expect(claims.attributes?.[ROLE_ATTRIBUTE_KEY]).toBe("speaker");
  });

  it("gives listeners subscribe-only grants", async () => {
    const res = await createParticipantToken(
      { sessionId: "test-room", displayName: "Bob", identity: "p-bob", role: "listener" },
      { env },
    );
    expect(res.permissions).toEqual({ canPublish: false, canSubscribe: true });
    const claims = await verifier.verify(res.token);
    expect(claims.video?.canPublish).toBe(false);
    expect(claims.video?.canSubscribe).toBe(true);
    expect(claims.video?.canPublishSources).toBeUndefined();
  });

  it("restricts publishers to the microphone source", async () => {
    const res = await createParticipantToken(
      { sessionId: "test-room", displayName: "Host", identity: "p-host", role: "host" },
      { env },
    );
    const claims = await verifier.verify(res.token);
    expect(claims.video?.canPublishSources).toEqual(["microphone"]);
  });

  it("falls back to the default role and generates an identity", async () => {
    const res = await createParticipantToken(
      { sessionId: "test-room", displayName: "Anon" },
      { env, generateIdentity: () => "p-generated" },
    );
    expect(res.role).toBe("speaker");
    expect(res.identity).toBe("p-generated");
    const claims = await verifier.verify(res.token);
    expect(claims.sub).toBe("p-generated");
  });

  it("never includes the API secret or key in the response", async () => {
    const res = await createParticipantToken({ sessionId: "s", displayName: "x", identity: "p-x" }, { env });
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain(env.LIVEKIT_API_SECRET);
    // The JWT header carries the key id (`iss`), which is public by design; the secret must not appear.
    expect(serialized.includes("supersecret")).toBe(false);
  });

  it("is rejected by a verifier with a different secret", async () => {
    const res = await createParticipantToken({ sessionId: "s", displayName: "x", identity: "p-x" }, { env });
    const other = new TokenVerifier(env.LIVEKIT_API_KEY, "another-secret-another-secret-another");
    await expect(other.verify(res.token)).rejects.toThrow();
  });

  it("expires according to the configured TTL", async () => {
    const res = await createParticipantToken({ sessionId: "s", displayName: "x", identity: "p-x" }, { env });
    const claims = await verifier.verify(res.token);
    const now = Math.floor(Date.now() / 1000);
    expect(claims.exp).toBeGreaterThan(now + 3600 - 30);
    expect(claims.exp).toBeLessThanOrEqual(now + 3600 + 30);
  });
});

describe("tokenRequestSchema", () => {
  it("accepts a valid request and trims whitespace", () => {
    const parsed = tokenRequestSchema.parse({ sessionId: " k7mq-x2pa ", displayName: "  Alice ", role: "host" });
    expect(parsed).toEqual({ sessionId: "k7mq-x2pa", displayName: "Alice", role: "host" });
  });

  it.each([
    { why: "too short", input: { sessionId: "ab", displayName: "Alice" } },
    { why: "space", input: { sessionId: "has space", displayName: "Alice" } },
    { why: "path chars", input: { sessionId: "../etc", displayName: "Alice" } },
    { why: "empty name", input: { sessionId: "ok-room", displayName: "" } },
    { why: "long name", input: { sessionId: "ok-room", displayName: "x".repeat(41) } },
    { why: "unknown role", input: { sessionId: "ok-room", displayName: "Alice", role: "admin" } },
    { why: "bad identity", input: { sessionId: "ok-room", displayName: "Alice", identity: "bad identity!" } },
  ])("rejects $why", ({ input }) => {
    expect(tokenRequestSchema.safeParse(input).success).toBe(false);
  });
});
