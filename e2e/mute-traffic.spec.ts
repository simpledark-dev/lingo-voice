/**
 * Privacy guarantee: a muted participant's audio never reaches anyone.
 * Measures RTP rates with two real clients: unmuted (full stream), both muted
 * (publisher emits only DTX keep-alives, subscribers receive nothing), one muted.
 */
import { expect, test, type Page } from "@playwright/test";

type Stats = { packets: number | null; bytes: number | null };
type Snapshot = {
  local: { identity: string } | null;
  stats: { local: Stats | null; remote: Record<string, Stats> };
};
type DebugWindow = Window & { __lingoVoice: { getSnapshot(): Snapshot } };

const snap = (p: Page): Promise<Snapshot> =>
  p.evaluate(() => (window as unknown as DebugWindow).__lingoVoice.getSnapshot());

interface Rates {
  sentPps: number;
  sentKbps: number;
  receivedPps: number;
  receivedKbps: number;
}

async function rates(page: Page, remoteIdentity: string, seconds: number): Promise<Rates> {
  const s0 = await snap(page);
  await page.waitForTimeout(seconds * 1000);
  const s1 = await snap(page);
  const delta = (a: number | null | undefined, b: number | null | undefined) => (b ?? 0) - (a ?? 0);
  return {
    sentPps: delta(s0.stats.local?.packets, s1.stats.local?.packets) / seconds,
    sentKbps: (delta(s0.stats.local?.bytes, s1.stats.local?.bytes) * 8) / seconds / 1000,
    receivedPps: delta(s0.stats.remote[remoteIdentity]?.packets, s1.stats.remote[remoteIdentity]?.packets) / seconds,
    receivedKbps: (delta(s0.stats.remote[remoteIdentity]?.bytes, s1.stats.remote[remoteIdentity]?.bytes) * 8) / seconds / 1000,
  };
}

test("muted participants send only DTX keep-alives and nobody receives their audio", async ({ browser }) => {
  test.setTimeout(180_000);
  const sessionId = `mute-${Date.now().toString(36)}`;
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  try {
    await a.goto(`/s/${sessionId}?name=Alice&autojoin=1`);
    await b.goto(`/s/${sessionId}?name=Bob&autojoin=1`);
    await expect(a.getByTestId("connection-status")).toHaveText("connected", { timeout: 30_000 });
    await expect(b.getByTestId("connection-status")).toHaveText("connected", { timeout: 30_000 });
    const idA = (await snap(a)).local!.identity;
    const idB = (await snap(b)).local!.identity;
    await expect(a.getByTestId("mic-state")).toHaveText("live");
    await expect(b.getByTestId("mic-state")).toHaveText("live");
    await a.waitForTimeout(5_000); // let stats settle

    const live = await rates(a, idB, 8);
    console.log("unmuted:", live);
    expect(live.sentPps).toBeGreaterThan(40);
    expect(live.receivedPps).toBeGreaterThan(40);

    await a.getByTestId("btn-mic").click();
    await b.getByTestId("btn-mic").click();
    await expect(a.getByTestId("mic-state")).toHaveText("muted");
    await expect(b.getByTestId("mic-state")).toHaveText("muted");
    await a.waitForTimeout(4_000); // drain in-flight packets

    const muted = await rates(a, idB, 8);
    console.log("both muted:", muted);
    expect(muted.sentPps).toBeLessThan(10); // DTX keep-alives only
    expect(muted.sentKbps).toBeLessThan(2);
    expect(muted.receivedPps).toBe(0); // server forwards nothing for a muted track

    await a.getByTestId("btn-mic").click();
    await expect(a.getByTestId("mic-state")).toHaveText("live");
    await a.waitForTimeout(4_000);

    const mixed = await rates(b, idA, 8);
    console.log("A live, B muted (measured on B):", mixed);
    expect(mixed.receivedPps).toBeGreaterThan(40); // B hears A again
    expect(mixed.sentPps).toBeLessThan(10); // B still muted
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
