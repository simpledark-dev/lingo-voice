import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";

const ENV_KEYS = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/token", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.LIVEKIT_URL = "wss://proj.livekit.cloud";
    process.env.LIVEKIT_API_KEY = "APIkey";
    process.env.LIVEKIT_API_SECRET = "a-very-secret-value-that-must-not-leak";
    process.env.LOG_LEVEL = "error";
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns a token response for a valid request", async () => {
    const res = await post({ sessionId: "room-1", displayName: "Alice", identity: "p-alice" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.serverUrl).toBe("wss://proj.livekit.cloud");
    expect(typeof json.token).toBe("string");
    expect(json.identity).toBe("p-alice");
    expect(JSON.stringify(json)).not.toContain("must-not-leak");
  });

  it("rejects invalid JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid-json");
  });

  it("rejects invalid fields with details", async () => {
    const res = await post({ sessionId: "x", displayName: "" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("invalid-request");
    expect(json.error.details.length).toBeGreaterThan(0);
  });

  it("returns 500 server-misconfigured without leaking anything when env is missing", async () => {
    delete process.env.LIVEKIT_API_SECRET;
    const res = await post({ sessionId: "room-1", displayName: "Alice" });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("server-misconfigured");
  });

  it("GET is not allowed", async () => {
    expect(GET().status).toBe(405);
  });
});
