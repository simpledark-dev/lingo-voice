/**
 * Full product flow with real clients against the local LiveKit server:
 * create a room -> it appears in the lobby -> a learner joins as listener and hears
 * the host -> chat both ways -> reaction -> raise hand -> host invites -> learner
 * speaks and the host hears them -> host deletes a message, changes the passage,
 * removes the learner from stage, mutes their chat -> host ends the room.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

type Snapshot = {
  status: string;
  local: { identity: string; role: string } | null;
  stats: { remote: Record<string, { bytes: number | null; totalAudioEnergy: number | null }> };
};
type DebugWindow = Window & { __lingoVoice: { getSnapshot(): Snapshot } };
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as DebugWindow).__lingoVoice.getSnapshot());

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
      { timeout: 30_000, message: `expected audio bytes from ${fromIdentity} to increase` },
    )
    .toBeGreaterThan(minNewBytes);
  await expect
    .poll(async () => (await snapshot(page)).stats.remote[fromIdentity]?.totalAudioEnergy ?? 0, { timeout: 30_000 })
    .toBeGreaterThan(0);
}

async function newPage(browser: Browser, label: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log(`[${label}] pageerror`, err.message));
  return page;
}

const room = (page: Page) => page.getByTestId("room");

test.describe.configure({ mode: "serial" });

test("host actions require the host key", async ({ request }) => {
  const created = await request.post("/api/rooms", { data: { title: "Auth check", language: "en", level: "beginner", hostName: "Hana" } });
  expect(created.status()).toBe(201);
  const { room: info, hostKey } = (await created.json()) as { room: { id: string }; hostKey: string };
  expect(JSON.stringify(info)).not.toContain("hostKeyHash");

  const noKey = await request.post(`/api/rooms/${info.id}/host`, { data: { action: "set-passage", passage: { title: "x", text: "y", language: "en", source: "custom" } } });
  expect(noKey.status()).toBe(401);
  const wrongKey = await request.post(`/api/rooms/${info.id}/host`, { headers: { "x-host-key": "not-the-key-not-the-key" }, data: { action: "end" } });
  expect(wrongKey.status()).toBe(401);
  const ok = await request.post(`/api/rooms/${info.id}/host`, { headers: { "x-host-key": hostKey }, data: { action: "end" } });
  expect(ok.status()).toBe(200);
  const gone = await request.get(`/api/rooms/${info.id}`);
  expect(gone.status()).toBe(404);
});

test("full live room flow", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const host = await newPage(browser, "host");
  const learner = await newPage(browser, "learner");

  // --- Host creates a room -------------------------------------------------
  await host.goto("/create");
  await host.getByTestId("create-name").fill("Hana");
  await host.getByTestId("create-language").selectOption("en");
  await host.getByTestId("create-level").selectOption("beginner");
  await host.getByTestId("create-title").fill("Evening English");
  await host.getByTestId("create-submit").click();
  await host.waitForURL(/\/room\//, { timeout: 30_000 });
  const roomId = new URL(host.url()).pathname.split("/").pop()!;

  await expect(host.getByTestId("gate-title")).toHaveText("Evening English");
  await expect(host.getByTestId("join-btn")).toHaveText("Start as host");
  await host.getByTestId("join-btn").click();
  await expect(room(host)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(room(host)).toHaveAttribute("data-role", "host");
  await expect(host.getByTestId("mic-btn")).toHaveText(/Mute/, { timeout: 20_000 });
  await expect(host.getByTestId("passage-title")).toHaveText("A morning at the market");
  const hostIdentity = (await snapshot(host)).local!.identity;

  // --- Lobby lists it; learner joins as listener ----------------------------
  await learner.goto("/");
  const card = learner.locator(`[data-testid="room-card"][data-room-id="${roomId}"]`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText("Evening English");
  await expect(card).toContainText("Hana");
  await card.click();
  await learner.waitForURL(new RegExp(`/room/${roomId}`));
  await learner.getByTestId("join-name").fill("Minh");
  await expect(learner.getByTestId("join-btn")).toHaveText("Join and listen");
  await learner.getByTestId("join-btn").click();
  await expect(room(learner)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(room(learner)).toHaveAttribute("data-role", "listener");
  await expect(learner.getByTestId("hand-btn")).toHaveText(/Raise hand/);
  const learnerIdentity = (await snapshot(learner)).local!.identity;

  await expect(host.getByTestId("people-btn")).toContainText("2", { timeout: 20_000 });
  await expect(learner.getByTestId("passage-title")).toHaveText("A morning at the market");
  await expectAudioFlowing(learner, hostIdentity);

  // --- Chat both ways --------------------------------------------------------
  await learner.getByTestId("chat-input").fill("Hello from Minh");
  await learner.getByTestId("chat-send").click();
  const learnerMsgOnHost = host.getByTestId("chat-message").filter({ hasText: "Hello from Minh" });
  await expect(learnerMsgOnHost).toBeVisible({ timeout: 15_000 });
  await host.getByTestId("chat-input").fill("Welcome! Raise your hand when you want to read.");
  await host.getByTestId("chat-send").click();
  await expect(learner.getByTestId("chat-message").filter({ hasText: "Welcome!" })).toBeVisible({ timeout: 15_000 });

  // --- Reaction --------------------------------------------------------------
  await learner.getByTestId("reactions-toggle").click();
  await learner.locator('[data-testid="reaction-btn"][data-emoji="👏"]').click();
  await expect.poll(() => host.getByTestId("reaction-overlay").getAttribute("data-count"), { timeout: 10_000 }).not.toBe("0");

  // --- Raise hand, host invites, learner speaks ------------------------------
  await learner.getByTestId("hand-btn").click();
  await expect(learner.getByTestId("hand-btn")).toHaveText(/Lower hand/, { timeout: 15_000 });
  await expect(learner.getByTestId("hand-prompt")).toBeVisible();

  await host.getByTestId("people-btn").click();
  const learnerRow = host.locator(`[data-testid="person-row"][data-identity="${learnerIdentity}"]`);
  await expect(learnerRow).toHaveAttribute("data-hand", "true", { timeout: 15_000 });
  await learnerRow.getByTestId("invite-btn").click();

  await expect(learner.getByTestId("on-stage-prompt")).toBeVisible({ timeout: 20_000 });
  await expect(room(learner)).toHaveAttribute("data-role", "speaker");
  await learner.getByTestId("mic-btn").click(); // Turn on mic
  await expect(learner.getByTestId("mic-btn")).toHaveText(/Mute/, { timeout: 20_000 });
  await expect(host.locator(`[data-testid="stage-member"][data-identity="${learnerIdentity}"]`)).toHaveAttribute("data-mic", "live", { timeout: 20_000 });
  await expectAudioFlowing(host, learnerIdentity);
  await expect(learnerRow).toHaveAttribute("data-stage-role", "speaker");
  await expect(learnerRow).toHaveAttribute("data-hand", "false");
  await host.getByRole("dialog", { name: "People" }).getByRole("button", { name: "Close" }).click();

  // --- Host moderates chat: delete the learner's message ----------------------
  await learnerMsgOnHost.getByTestId("chat-delete").click();
  await expect(learnerMsgOnHost).toHaveCount(0);
  await expect(learner.getByTestId("chat-message").filter({ hasText: "Hello from Minh" })).toHaveCount(0, { timeout: 15_000 });

  // --- Host changes the passage ----------------------------------------------
  await host.getByTestId("change-passage").click();
  await host.getByRole("button", { name: "All levels" }).click(); // picker opens filtered to the room level
  await host.getByTestId("passage-en-i1").click();
  await expect(host.getByTestId("passage-title")).toHaveText("Learning to listen", { timeout: 15_000 });
  await expect(learner.getByTestId("passage-title")).toHaveText("Learning to listen", { timeout: 15_000 });

  // --- Remove from stage, then mute chat ------------------------------------
  await host.getByTestId("people-btn").click();
  await learnerRow.getByTestId("person-menu").click();
  await host.getByTestId("menu-remove-stage").click();
  await expect(room(learner)).toHaveAttribute("data-role", "listener", { timeout: 20_000 });
  await expect(learner.getByTestId("hand-btn")).toHaveText(/Raise hand/);
  await expect(host.locator(`[data-testid="stage-member"][data-identity="${learnerIdentity}"]`)).toHaveCount(0, { timeout: 15_000 });

  await learnerRow.getByTestId("person-menu").click();
  await host.getByTestId("menu-mute-chat").click();
  await expect(learner.getByTestId("chat-input")).toBeDisabled({ timeout: 20_000 });
  await expect(learnerRow).toContainText("chat muted", { timeout: 15_000 });
  await host.getByRole("dialog", { name: "People" }).getByRole("button", { name: "Close" }).click();

  // --- Host ends the room ------------------------------------------------------
  await host.getByTestId("host-menu-btn").click();
  await host.getByTestId("menu-end-room").click();
  await host.getByTestId("confirm-end").click();
  await expect(learner.getByTestId("room-ended")).toBeVisible({ timeout: 30_000 });
  await expect(host.getByTestId("room-ended")).toBeVisible({ timeout: 30_000 });

  const list = await request.get("/api/rooms");
  const rooms = ((await list.json()) as { rooms: Array<{ id: string }> }).rooms;
  expect(rooms.find((r) => r.id === roomId)).toBeUndefined();

  await host.context().close();
  await learner.context().close();
});

test("host keeps control after a reload and a removed learner sees why", async ({ browser }) => {
  test.setTimeout(180_000);
  const host = await newPage(browser, "host2");
  const learner = await newPage(browser, "learner2");

  await host.goto("/create");
  await host.getByTestId("create-name").fill("Hana");
  await host.getByTestId("create-submit").click();
  await host.waitForURL(/\/room\//, { timeout: 30_000 });
  const roomId = new URL(host.url()).pathname.split("/").pop()!;
  await host.getByTestId("join-btn").click();
  await expect(room(host)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });

  await learner.goto(`/room/${roomId}`);
  await learner.getByTestId("join-name").fill("Linh");
  await learner.getByTestId("join-btn").click();
  await expect(room(learner)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  const learnerIdentity = (await snapshot(learner)).local!.identity;

  // Reload the host tab: the host key lives in localStorage, so the gate offers "Start as host" again.
  await host.reload();
  await expect(host.getByTestId("join-btn")).toHaveText("Start as host", { timeout: 20_000 });
  await host.getByTestId("join-btn").click();
  await expect(room(host)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(room(host)).toHaveAttribute("data-role", "host");
  await expect(host.getByTestId("people-btn")).toContainText("2", { timeout: 20_000 });

  // Remove the learner from the room.
  await host.getByTestId("people-btn").click();
  await host.locator(`[data-testid="person-row"][data-identity="${learnerIdentity}"]`).getByTestId("person-menu").click();
  await host.getByTestId("menu-remove").click();
  await expect(learner.getByTestId("room-removed")).toBeVisible({ timeout: 30_000 });
  await expect(host.getByTestId("people-btn")).toContainText("1", { timeout: 20_000 });

  await host.context().close();
  await learner.context().close();
});
