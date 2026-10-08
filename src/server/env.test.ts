import { describe, expect, it } from "vitest";
import { ConfigError, describeConfig, loadServerEnv } from "./env";

const good = {
  LIVEKIT_URL: "wss://proj.livekit.cloud",
  LIVEKIT_API_KEY: "key",
  LIVEKIT_API_SECRET: "secret",
};

describe("loadServerEnv", () => {
  it("loads required values with defaults", () => {
    const env = loadServerEnv(good);
    expect(env.LIVEKIT_TOKEN_TTL_SECONDS).toBe(7200);
    expect(env.DEFAULT_PARTICIPANT_ROLE).toBe("speaker");
  });

  it("names every missing variable without leaking values", () => {
    try {
      loadServerEnv({ LIVEKIT_URL: "wss://x" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const issues = (err as ConfigError).issues;
      expect(issues).toContain("LIVEKIT_API_KEY is not set");
      expect(issues).toContain("LIVEKIT_API_SECRET is not set");
    }
  });

  it("rejects a non-websocket URL, bad TTL and bad role", () => {
    expect(() => loadServerEnv({ ...good, LIVEKIT_URL: "ftp://nope" })).toThrow(ConfigError);
    expect(() => loadServerEnv({ ...good, LIVEKIT_TOKEN_TTL_SECONDS: "10" })).toThrow(ConfigError);
    expect(() => loadServerEnv({ ...good, DEFAULT_PARTICIPANT_ROLE: "admin" })).toThrow(ConfigError);
  });

  it("accepts ws:// for local development", () => {
    expect(loadServerEnv({ ...good, LIVEKIT_URL: "ws://127.0.0.1:7880" }).LIVEKIT_URL).toBe("ws://127.0.0.1:7880");
  });
});

describe("describeConfig", () => {
  it("reports host only", () => {
    const d = describeConfig(good);
    expect(d).toEqual({ configured: true, serverUrlHost: "proj.livekit.cloud", issues: [] });
    expect(JSON.stringify(d)).not.toContain("secret");
  });
  it("reports issues when unconfigured", () => {
    expect(describeConfig({}).configured).toBe(false);
  });
});
