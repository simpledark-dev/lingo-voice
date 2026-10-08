/**
 * Real two-client voice tests against a local LiveKit server.
 *
 * Each "client" is a separate Chromium browser context (own storage, own identity)
 * with a fake microphone that plays speech-like tone bursts. Assertions go through
 * the UI (data-testid) and through the debug handle `window.__lingoVoice`, which
 * exposes real WebRTC receiver stats (packets, audio energy).
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

type Snapshot = {
  status: string;
  local: { identity: string } | null;
  participants: Array<{
    identity: string;
    isLocal: boolean;
    isSpeaking: boolean;
    microphone: { published: boolean; muted: boolean; subscribed: boolean | null };
  }>;
  microphone: { state: string; error: { code: string } | null };
  stats: {
    local: { bytes: number | null } | null;
    remote: Record<string, { bytes: number | null; totalAudioEnergy: number | null }>;
  };
  audioPlayback: { allowed: boolean };
  events: Array<{ type: string }>;
  roomGeneration: number;
};

type DebugHandle = { getSnapshot(): Snapshot; simulate(scenario: string): Promise<void> };
type DebugWindow = Window & { __lingoVoice: DebugHandle; __restoreMic?: () => void };

interface Client {
  context: BrowserContext;
  page: Page;
  name: string;
  identity: string;
}

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => (window as unknown as DebugWindow).__lingoVoice.getSnapshot());

async function openClient(
  browser: Browser,
  sessionId: string,
  name: string,
  opts: { role?: string; autojoin?: boolean; init?: (page: Page) => Promise<void> } = {},
): Promise<Client> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log(`[${name}] pageerror`, err.message));
  if (opts.init) await opts.init(page);
  const params = new URLSearchParams({ name });
  if (opts.autojoin !== false) params.set("autojoin", "1");
  if (opts.role) params.set("role", opts.role);
  await page.goto(`/s/${sessionId}?${params.toString()}`);
  return { context, page, name, identity: "" };
}

async function waitConnected(client: Client): Promise<void> {
  await expect(client.page.getByTestId("connection-status")).toHaveText("connected", { timeout: 30_000 });
  const snap = await snapshot(client.page);
  client.identity = snap.local!.identity;
  expect(client.identity).toMatch(/^p-/);
}

function row(page: Page, identity: string) {
  return page.locator(`[data-testid="participant-row"][data-identity="${identity}"]`);
}

/**
 * Proves real audio arrives: received RTP bytes grow and the decoded audio has energy.
 * Counters restart when the remote track is re-created (participant rejoined), so the
 * baseline is re-anchored whenever the value drops.
 */
async function expectAudioFlowing(page: Page, fromIdentity: string, minNewBytes = 4_000): Promise<void> {
  let baseline: number | null = null;
  await expect
    .poll(
      async () => {
        const bytes = (await snapshot(page)).stats.remote[fromIdentity]?.bytes ?? null;
        if (bytes === null) return 0;
        if (baseline === null || bytes < baseline) {
          baseline = bytes;
          return 0;
        }
        return bytes - baseline;
      },
      { timeout: 30_000, message: `expected received audio bytes from ${fromIdentity} to increase` },
    )
    .toBeGreaterThan(minNewBytes);
  await expect
    .poll(async () => (await snapshot(page)).stats.remote[fromIdentity]?.totalAudioEnergy ?? 0, {
      timeout: 30_000,
      message: `expected non-zero audio energy from ${fromIdentity}`,
    })
    .toBeGreaterThan(0);
}

async function eventSeen(page: Page, types: string[]): Promise<boolean> {
  const snap = await snapshot(page);
  return snap.events.some((e) => types.includes(e.type));
}

const newSessionId = () => `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

test.describe.configure({ mode: "serial" });

test("health endpoint reports LiveKit configuration", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.livekit.configured).toBe(true);
  expect(json.livekit.serverUrlHost).toBe("127.0.0.1:7880");
});

test("token endpoint validates input and never leaks the secret", async ({ request }) => {
  const bad = await request.post("/api/token", { data: { sessionId: "x", displayName: "" } });
  expect(bad.status()).toBe(400);
  const good = await request.post("/api/token", { data: { sessionId: "e2e-token", displayName: "Tester" } });
  expect(good.status()).toBe(200);
  const json = await good.json();
  expect(json.serverUrl).toBe("ws://127.0.0.1:7880");
  expect(json.identity).toMatch(/^p-/);
  expect(JSON.stringify(json)).not.toContain('"secret"');
});

test.describe("two clients", () => {
  let a: Client;
  let b: Client;
  let sessionId: string;

  test.beforeAll(async ({ browser }) => {
    sessionId = newSessionId();
    a = await openClient(browser, sessionId, "Alice");
    b = await openClient(browser, sessionId, "Bob");
    await waitConnected(a);
    await waitConnected(b);
  });

  test.afterAll(async () => {
    await a?.context.close();
    await b?.context.close();
  });

  test("M2: both participants see each other", async () => {
    await expect(a.page.getByTestId("participant-row")).toHaveCount(2);
    await expect(b.page.getByTestId("participant-row")).toHaveCount(2);
    await expect(row(a.page, b.identity)).toContainText("Bob");
    await expect(row(b.page, a.identity)).toContainText("Alice");
    await expect(row(a.page, a.identity)).toHaveAttribute("data-local", "true");
  });

  test("M3: both publish microphones and receive each other's real audio", async () => {
    await expect(a.page.getByTestId("mic-state")).toHaveText("live");
    await expect(b.page.getByTestId("mic-state")).toHaveText("live");
    await expect(row(a.page, b.identity)).toHaveAttribute("data-mic", "live");
    await expect(row(a.page, b.identity)).toHaveAttribute("data-subscribed", "true");
    await expect(row(b.page, a.identity)).toHaveAttribute("data-subscribed", "true");
    await expect(a.page.getByTestId("audio-playback")).toHaveText("allowed");

    await expectAudioFlowing(a.page, b.identity);
    await expectAudioFlowing(b.page, a.identity);

    // Server-side active speaker detection reacts to the fake microphone bursts.
    await expect
      .poll(async () => (await snapshot(a.page)).participants.find((p) => p.identity === b.identity)?.isSpeaking ?? false, {
        timeout: 30_000,
      })
      .toBe(true);
    await expect(row(a.page, b.identity)).toHaveAttribute("data-speaking", "true");
  });

  test("M4: mute and unmute propagate to the other side", async () => {
    await a.page.getByTestId("btn-mic").click();
    await expect(a.page.getByTestId("mic-state")).toHaveText("muted");
    await expect(row(b.page, a.identity)).toHaveAttribute("data-mic", "muted");
    await expect(row(a.page, a.identity)).toHaveAttribute("data-mic", "muted");

    await a.page.getByTestId("btn-mic").click();
    await expect(a.page.getByTestId("mic-state")).toHaveText("live");
    await expect(row(b.page, a.identity)).toHaveAttribute("data-mic", "live");
    await expectAudioFlowing(b.page, a.identity);
  });

  test("M5: signal reconnect is recovered by the SDK and audio continues", async () => {
    await a.page.evaluate(() => (window as unknown as DebugWindow).__lingoVoice.simulate("signal-reconnect"));
    await expect.poll(() => eventSeen(a.page, ["reconnecting", "signal.reconnecting"]), { timeout: 20_000 }).toBe(true);
    await expect(a.page.getByTestId("connection-status")).toHaveText("connected", { timeout: 40_000 });
    await expect.poll(() => eventSeen(a.page, ["reconnected"]), { timeout: 20_000 }).toBe(true);
    await expect(a.page.getByTestId("participant-row")).toHaveCount(2);
    await expectAudioFlowing(a.page, b.identity);
    await expectAudioFlowing(b.page, a.identity);
  });

  test("M5: forced full reconnect (new peer connections) is recovered", async () => {
    await a.page.evaluate(() => (window as unknown as DebugWindow).__lingoVoice.simulate("full-reconnect"));
    await expect.poll(() => eventSeen(a.page, ["reconnecting"]), { timeout: 20_000 }).toBe(true);
    await expect(a.page.getByTestId("connection-status")).toHaveText("connected", { timeout: 40_000 });
    await expect(a.page.getByTestId("mic-state")).toHaveText("live", { timeout: 20_000 });
    await expectAudioFlowing(a.page, b.identity);
    await expectAudioFlowing(b.page, a.identity);
  });

  test("M5: going offline then online recovers the session", async () => {
    const generationBefore = (await snapshot(a.page)).roomGeneration;
    await a.context.setOffline(true);
    await expect
      .poll(async () => (await snapshot(a.page)).status, { timeout: 45_000, message: "status should leave 'connected'" })
      .not.toBe("connected");
    await a.page.waitForTimeout(2_000);
    await a.context.setOffline(false);
    await expect(a.page.getByTestId("connection-status")).toHaveText("connected", { timeout: 60_000 });
    await expect(a.page.getByTestId("mic-state")).toHaveText("live", { timeout: 20_000 });
    await expect(a.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 20_000 });
    await expect(b.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 20_000 });
    await expectAudioFlowing(a.page, b.identity);
    await expectAudioFlowing(b.page, a.identity);
    const generationAfter = (await snapshot(a.page)).roomGeneration;
    console.log(`offline test recovered via ${generationAfter > generationBefore ? "rejoin (fresh token)" : "SDK reconnect"}`);
  });

  test("M5: server-side disconnect triggers automatic rejoin with a fresh token", async () => {
    const generationBefore = (await snapshot(a.page)).roomGeneration;
    await a.page.evaluate(() => (window as unknown as DebugWindow).__lingoVoice.simulate("server-leave"));
    await expect.poll(() => eventSeen(a.page, ["rejoin.scheduled"]), { timeout: 30_000 }).toBe(true);
    await expect(a.page.getByTestId("connection-status")).toHaveText("connected", { timeout: 60_000 });
    expect((await snapshot(a.page)).roomGeneration).toBeGreaterThan(generationBefore);
    await expect(a.page.getByTestId("mic-state")).toHaveText("live", { timeout: 20_000 });
    await expect(b.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 20_000 });
    await expect(row(b.page, a.identity)).toHaveCount(1);
    await expectAudioFlowing(a.page, b.identity);
    await expectAudioFlowing(b.page, a.identity);
  });

  test("M5: browser refresh rejoins with the same identity and no duplicate participant", async () => {
    const identityBefore = a.identity;
    await a.page.reload();
    await waitConnected(a);
    expect(a.identity).toBe(identityBefore);
    await expect(b.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 20_000 });
    await expect(row(b.page, identityBefore)).toHaveCount(1);
    await expect(a.page.getByTestId("mic-state")).toHaveText("live", { timeout: 20_000 });
    await expectAudioFlowing(b.page, a.identity);
    await expectAudioFlowing(a.page, b.identity);
  });

  test("leave removes the participant for others; join brings them back", async () => {
    await a.page.getByTestId("btn-leave").click();
    await expect(a.page.getByTestId("connection-status")).toHaveText("idle");
    await expect(a.page.getByTestId("mic-state")).toHaveText("off");
    await expect(b.page.getByTestId("participant-row")).toHaveCount(1, { timeout: 20_000 });

    await a.page.getByTestId("btn-join").click();
    await waitConnected(a);
    await expect(b.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 20_000 });
    await expectAudioFlowing(b.page, a.identity);
  });

  test("listener role cannot publish but hears speakers", async ({ browser }) => {
    const c = await openClient(browser, sessionId, "Carol", { role: "listener" });
    try {
      await waitConnected(c);
      await expect(c.page.getByTestId("local-role")).toHaveText("listener");
      await expect(c.page.getByTestId("mic-state")).toHaveText("not-allowed");
      await expect(c.page.getByTestId("btn-mic")).toBeDisabled();
      await expect(row(a.page, c.identity)).toHaveAttribute("data-mic", "none");
      await expect(row(a.page, c.identity)).toHaveAttribute("data-role", "listener");
      await expectAudioFlowing(c.page, a.identity);
      await expectAudioFlowing(c.page, b.identity);
      await expect(c.page.getByTestId("participant-row")).toHaveCount(3);
      // Clean leave: others drop the participant immediately.
      await c.page.getByTestId("btn-leave").click();
      await expect(c.page.getByTestId("connection-status")).toHaveText("idle");
      await expect(a.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 10_000 });
    } finally {
      await c.context.close();
    }
  });

  test("microphone permission denied is recoverable without rejoining", async ({ browser }) => {
    const d = await openClient(browser, sessionId, "Dan", {
      init: async (page) => {
        await page.addInitScript(() => {
          const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
          (window as unknown as { __restoreMic?: () => void }).__restoreMic = () => {
            navigator.mediaDevices.getUserMedia = original;
          };
          navigator.mediaDevices.getUserMedia = () =>
            Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
        });
      },
    });
    try {
      await waitConnected(d);
      await expect(d.page.getByTestId("mic-state")).toHaveText("error");
      await expect(d.page.getByTestId("mic-error-banner")).toHaveAttribute("data-code", "mic-permission-denied");
      // Still connected and still hears others.
      await expectAudioFlowing(d.page, a.identity);
      await expect(row(a.page, d.identity)).toHaveAttribute("data-mic", "none");

      await d.page.evaluate(() => (window as unknown as DebugWindow).__restoreMic!());
      await d.page.getByTestId("btn-retry-mic").click();
      await expect(d.page.getByTestId("mic-state")).toHaveText("live", { timeout: 20_000 });
      await expect(row(a.page, d.identity)).toHaveAttribute("data-mic", "live");
      await expectAudioFlowing(a.page, d.identity);
    } finally {
      await d.context.close();
    }
    // Abrupt close (no leave message, like a killed tab): the server removes the
    // participant after its reconnect grace period. Measure how long that takes.
    const started = Date.now();
    await expect(a.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 90_000 });
    console.log(`abruptly closed participant removed by server after ~${Math.round((Date.now() - started) / 1000)}s`);
  });

  test("duplicate identity from another tab kicks the stale connection with a clear message", async () => {
    // Copy A's sessionStorage identity into a new page of the same context (simulates "duplicate tab").
    const identity = a.identity;
    const dup = await a.context.newPage();
    await dup.addInitScript((id) => {
      window.sessionStorage.setItem("lingo-voice.identity", id);
    }, identity);
    try {
      await dup.goto(`/s/${sessionId}?name=Alice&autojoin=1`);
      await expect(dup.getByTestId("connection-status")).toHaveText("connected", { timeout: 30_000 });
      await expect(a.page.getByTestId("connection-status")).toHaveText("disconnected", { timeout: 30_000 });
      await expect(a.page.getByTestId("error-banner")).toHaveAttribute("data-code", "duplicate-identity");
      await expect(b.page.getByTestId("participant-row")).toHaveCount(2);
      await expect(row(b.page, identity)).toHaveCount(1);
    } finally {
      await dup.close();
    }
    // Take the session back from the original tab.
    await a.page.getByTestId("btn-rejoin").click();
    await waitConnected(a);
    await expect(b.page.getByTestId("participant-row")).toHaveCount(2, { timeout: 20_000 });
    await expectAudioFlowing(b.page, a.identity);
  });
});
