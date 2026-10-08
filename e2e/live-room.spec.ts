/**
 * Full product flow with real clients against the local LiveKit server and a
 * throwaway SQLite database: guest accounts, lobby presence, invites, create a
 * room, join as listener, chat, reactions, hand raise, stage, moderation, end.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

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

/** First visit shows the welcome screen; "Continue as guest" creates the account. */
async function continueAsGuest(page: Page): Promise<void> {
  await expect(page.getByTestId("welcome-screen")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("google-login")).toBeDisabled();
  await page.getByTestId("guest-continue").click();
  await expect(page.getByTestId("welcome-screen")).toHaveCount(0, { timeout: 20_000 });
}

/** Rename the current guest account through the inline editor (lobby, create page, join screen). */
async function renameVia(page: Page, name: string): Promise<void> {
  await page.getByTestId("rename-btn").click();
  await page.getByTestId("rename-input").fill(name);
  await page.getByTestId("rename-save").click();
  await expect(page.getByTestId("me-name")).toHaveText(name);
}

const room = (page: Page) => page.getByTestId("room");

async function meId(context: BrowserContext): Promise<string> {
  const res = await context.request.get("/api/me");
  const user = ((await res.json()) as { user: { id: string } | null }).user;
  if (!user) throw new Error("no account in this context");
  return user.id;
}

async function apiGuest(context: BrowserContext): Promise<string> {
  const res = await context.request.post("/api/auth/guest");
  expect([200, 201]).toContain(res.status());
  return ((await res.json()) as { user: { id: string } }).user.id;
}

test.describe.configure({ mode: "serial" });

test("guest accounts: welcome screen, continue as guest, persisted by cookie, renamable", async ({ browser }) => {
  const page = await newPage(browser, "guest");
  // Nothing is created before the user chooses to continue.
  const before = await page.context().request.get("/api/me");
  expect(((await before.json()) as { user: unknown }).user).toBeNull();
  await page.goto("/");
  await continueAsGuest(page);
  const name = await page.getByTestId("me-name").textContent();
  expect(name?.trim().split(" ")).toHaveLength(2); // "Curious Heron" style
  await page.reload();
  await expect(page.getByTestId("welcome-screen")).toHaveCount(0); // cookie skips the welcome screen
  await expect(page.getByTestId("me-name")).toHaveText(name!.trim());
  await renameVia(page, "Hana");
  await page.reload();
  await expect(page.getByTestId("me-name")).toHaveText("Hana");
  // Online panel lists me (desktop viewport) and the count is at least 1.
  await expect(page.getByTestId("online-list").locator('[data-testid="online-person"]').filter({ hasText: "Hana" })).toBeVisible();
  expect(Number(await page.getByTestId("online-count").textContent())).toBeGreaterThanOrEqual(1);
  await page.context().close();
});

test("host actions require the host's own session", async ({ browser }) => {
  const host = await browser.newContext();
  const stranger = await browser.newContext();
  const unauthenticated = await host.request.post("/api/rooms", { data: { title: "Auth check", language: "en", level: "beginner" } });
  expect(unauthenticated.status()).toBe(401); // no account yet
  await apiGuest(host);
  const created = await host.request.post("/api/rooms", { data: { title: "Auth check", language: "en", level: "beginner" } });
  expect(created.status()).toBe(201);
  const { room: info } = (await created.json()) as { room: { id: string; host: { identity: string } } };
  expect(info.host.identity).toBe(await meId(host));

  const anonymous = await browser.newContext();
  const noSession = await anonymous.request.post(`/api/rooms/${info.id}/host`, { data: { action: "end" } });
  expect(noSession.status()).toBe(401);
  await apiGuest(stranger);
  const otherUser = await stranger.request.post(`/api/rooms/${info.id}/host`, { data: { action: "end" } });
  expect(otherUser.status()).toBe(403);
  const invitesForbidden = await stranger.request.post(`/api/rooms/${info.id}/invites`, { data: { toUserId: await meId(host) } });
  expect(invitesForbidden.status()).toBe(403);

  const ok = await host.request.post(`/api/rooms/${info.id}/host`, { data: { action: "end" } });
  expect(ok.status()).toBe(200);
  expect((await host.request.get(`/api/rooms/${info.id}`)).status()).toBe(404);
  await Promise.all([host.close(), stranger.close(), anonymous.close()]);
});

test("full live room flow", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const host = await newPage(browser, "host");
  const learner = await newPage(browser, "learner");

  // --- Host account + room ------------------------------------------------------
  await host.goto("/");
  await continueAsGuest(host);
  await renameVia(host, "Hana");
  await host.getByTestId("create-room-link").click();
  await host.waitForURL(/\/create/);
  await expect(host.getByTestId("me-name")).toHaveText("Hana");
  await host.getByTestId("create-language").selectOption("en");
  await host.getByTestId("create-level").selectOption("beginner");
  await host.getByTestId("create-title").fill("Evening English");
  await host.getByTestId("create-submit").click();
  await host.waitForURL(/\/room\//, { timeout: 30_000 });
  const roomId = new URL(host.url()).pathname.split("/").pop()!;

  await expect(host.getByTestId("gate-title")).toHaveText("Evening English");
  await expect(host.getByTestId("join-name")).toHaveCount(0); // no per-session name box
  await expect(host.getByTestId("me-name")).toHaveText("Hana");
  await expect(host.getByTestId("join-btn")).toHaveText("Start as host");
  await host.getByTestId("join-btn").click();
  await expect(room(host)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(room(host)).toHaveAttribute("data-role", "host");
  await expect(host.getByTestId("mic-btn")).toHaveText(/Mute/, { timeout: 20_000 });
  await expect(host.getByTestId("end-room-btn")).toBeVisible();
  const hostIdentity = (await snapshot(host)).local!.identity;
  expect(hostIdentity).toMatch(/^u-/); // identity is the account id

  // --- Lobby: room listed, host shown online inside it ---------------------------
  await learner.goto("/");
  await continueAsGuest(learner);
  const card = learner.locator(`[data-testid="room-card"][data-room-id="${roomId}"]`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText("Evening English");
  await expect(card).toContainText("Hana");
  const hostOnline = learner.locator(`[data-testid="online-person"][data-user-id="${hostIdentity}"]`);
  await expect(hostOnline).toBeVisible({ timeout: 30_000 });
  await expect(hostOnline).toHaveAttribute("data-location", "room");
  await expect(hostOnline).toContainText("Evening English");
  expect(Number(await learner.getByTestId("online-count").textContent())).toBeGreaterThanOrEqual(2);

  // --- Learner joins as listener --------------------------------------------------
  await card.click();
  await learner.waitForURL(new RegExp(`/room/${roomId}`));
  await renameVia(learner, "Minh"); // the join screen shows the account name with an inline Change
  await expect(learner.getByTestId("join-btn")).toHaveText("Join and listen");
  await learner.getByTestId("join-btn").click();
  await expect(room(learner)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(room(learner)).toHaveAttribute("data-role", "listener");
  await expect(learner.getByTestId("hand-btn")).toHaveText(/Raise hand/);
  const learnerIdentity = (await snapshot(learner)).local!.identity;
  expect(learnerIdentity).toBe(await meId(learner.context()));

  await expect(host.getByTestId("people-btn")).toContainText("2", { timeout: 20_000 });
  await expect(learner.getByTestId("passage-title")).toHaveText("A morning at the market");
  await expectAudioFlowing(learner, hostIdentity);

  // --- Chat both ways --------------------------------------------------------
  await learner.getByTestId("chat-input").fill("Hello from Minh");
  await learner.getByTestId("chat-send").click();
  const learnerMsgOnHost = host.getByTestId("chat-message").filter({ hasText: "Hello from Minh" });
  await expect(learnerMsgOnHost).toBeVisible({ timeout: 15_000 });
  await expect(learnerMsgOnHost).toContainText("Minh");
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
  // The learner sees themselves first in the queue.
  await expect(learner.getByTestId("hands-row").first()).toHaveAttribute("data-identity", learnerIdentity, { timeout: 15_000 });

  // The host sees the raised hand in the room itself, without opening People, and invites from there.
  const queueRow = host.locator(`[data-testid="hands-row"][data-identity="${learnerIdentity}"]`);
  await expect(queueRow).toBeVisible({ timeout: 15_000 });
  await expect(host.getByTestId("hands-badge")).toHaveText(/1/);
  await queueRow.getByTestId("hands-invite-btn").click();
  await expect(host.getByTestId("hands-queue")).toHaveCount(0, { timeout: 15_000 }); // hand cleared on invite

  await expect(learner.getByTestId("on-stage-prompt")).toBeVisible({ timeout: 20_000 });
  await host.getByTestId("people-btn").click();
  const learnerRow = host.locator(`[data-testid="person-row"][data-identity="${learnerIdentity}"]`);
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
  await host.getByRole("button", { name: "All levels" }).click();
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

  // --- Host ends the room from the header button ------------------------------
  await host.getByTestId("end-room-btn").click();
  await host.getByTestId("confirm-end").click();
  await expect(learner.getByTestId("room-ended")).toBeVisible({ timeout: 30_000 });
  await expect(host.getByTestId("room-ended")).toBeVisible({ timeout: 30_000 });

  const list = await request.get("/api/rooms");
  const rooms = ((await list.json()) as { rooms: Array<{ id: string }> }).rooms;
  expect(rooms.find((r) => r.id === roomId)).toBeUndefined();

  await host.context().close();
  await learner.context().close();
});

test("host invites someone from the lobby; they get the invite and join", async ({ browser }) => {
  test.setTimeout(180_000);
  const host = await newPage(browser, "host2");
  const guest = await newPage(browser, "guest2");

  await host.goto("/");
  await continueAsGuest(host);
  await renameVia(host, "Hana");
  await host.goto("/create");
  await host.getByTestId("create-title").fill("Invite me");
  await host.getByTestId("create-submit").click();
  await host.waitForURL(/\/room\//, { timeout: 30_000 });
  const roomId = new URL(host.url()).pathname.split("/").pop()!;
  await host.getByTestId("join-btn").click();
  await expect(room(host)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });

  // A stranger opening the room link gets the welcome screen first, then the join screen.
  const stranger = await newPage(browser, "stranger");
  await stranger.goto(`/room/${roomId}`);
  await continueAsGuest(stranger);
  await expect(stranger.getByTestId("gate-title")).toHaveText("Invite me", { timeout: 20_000 });
  await stranger.context().close();

  // Guest browses the lobby (becomes "online, in the lobby").
  await guest.goto("/");
  await continueAsGuest(guest);
  await renameVia(guest, "Linh");
  const guestId = await meId(guest.context());

  // Host sees them under "In the lobby" and invites.
  await host.getByTestId("people-btn").click();
  const guestRow = host.locator(`[data-testid="lobby-person"][data-user-id="${guestId}"]`);
  await expect(guestRow).toBeVisible({ timeout: 20_000 });
  await expect(guestRow).toContainText("Linh");
  await guestRow.getByTestId("lobby-invite-btn").click();
  await expect(guestRow).toHaveAttribute("data-invited", "true");

  // Guest's lobby shows the invite within a poll interval; Join leads to the room gate.
  const banner = guest.getByTestId("invite-banner");
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner).toContainText("Hana");
  await expect(banner).toContainText("Invite me");
  await guest.getByTestId("invite-join").click();
  await guest.waitForURL(new RegExp(`/room/${roomId}`), { timeout: 20_000 });
  await expect(guest.getByTestId("gate-title")).toHaveText("Invite me");
  await expect(guest.getByTestId("me-name")).toHaveText("Linh");
  await guest.getByTestId("join-btn").click();
  await expect(room(guest)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(host.getByTestId("people-btn")).toContainText("2", { timeout: 20_000 });

  // Invite is no longer pending for the host's list.
  await expect(guestRow).toHaveCount(0, { timeout: 20_000 });

  // Reload the host tab: the account cookie keeps host control.
  await host.reload();
  await expect(host.getByTestId("join-btn")).toHaveText("Start as host", { timeout: 20_000 });
  await host.getByTestId("join-btn").click();
  await expect(room(host)).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(room(host)).toHaveAttribute("data-role", "host");

  // Remove the guest from the room; they are told why.
  await host.getByTestId("people-btn").click();
  await host.locator(`[data-testid="person-row"][data-identity="${guestId}"]`).getByTestId("person-menu").click();
  await host.getByTestId("menu-remove").click();
  await expect(guest.getByTestId("room-removed")).toBeVisible({ timeout: 30_000 });

  await host.context().close();
  await guest.context().close();
});
