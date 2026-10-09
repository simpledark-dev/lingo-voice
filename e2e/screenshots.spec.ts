/**
 * Visual snapshots of every screen at phone and desktop sizes. Not a test:
 * runs only with SHOTS=1 and writes PNGs to test-results/shots/.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "test-results/shots";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 860 };

async function open(browser: Browser, viewport: { width: number; height: number }, mobile: boolean): Promise<Page> {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
  return context.newPage();
}
async function guest(page: Page, name: string): Promise<void> {
  await page.goto("/create"); // the create page keeps the inline name editor
  await page.getByTestId("guest-continue").click();
  await page.getByTestId("rename-btn").click();
  await page.getByTestId("rename-input").fill(name);
  await page.getByTestId("rename-save").click();
  await expect(page.getByTestId("me-name")).toHaveText(name);
  await page.goto("/");
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

test.skip(!process.env.SHOTS, "set SHOTS=1 to capture");

test("capture screens", async ({ browser }) => {
  test.setTimeout(240_000);
  mkdirSync(OUT, { recursive: true });
  const host = await open(browser, DESKTOP, false);
  const learner = await open(browser, PHONE, true);
  const extra = await open(browser, PHONE, true);

  // Welcome + lobby (phone, empty)
  await learner.goto("/");
  await expect(learner.getByTestId("guest-continue")).toBeVisible();
  await shot(learner, "phone-welcome");
  await guest(learner, "Minh");
  await expect(learner.getByTestId("rooms-empty").or(learner.getByTestId("room-list"))).toBeVisible();
  await shot(learner, "phone-lobby-empty");

  // Host creates a room (desktop)
  await guest(host, "Hana");
  await host.goto("/create");
  await shot(host, "desktop-create");
  await host.getByTestId("create-title").fill("Evening English");
  await host.getByTestId("create-submit").click();
  await host.waitForURL(/\/room\//);
  const roomId = new URL(host.url()).pathname.split("/").pop()!;
  await expect(host.getByTestId("join-btn")).toBeVisible();
  await shot(host, "desktop-gate-host");
  await host.getByTestId("join-btn").click();
  await expect(host.getByTestId("room")).toHaveAttribute("data-status", "connected", { timeout: 30_000 });

  // Learner lobby with a room + online list, then gate
  await learner.goto("/");
  await expect(learner.getByTestId("room-card")).toBeVisible({ timeout: 20_000 });
  await shot(learner, "phone-lobby");
  await learner.getByTestId("online-toggle").click();
  await learner.waitForTimeout(300);
  await shot(learner, "phone-lobby-online-view");
  await learner.getByTestId("online-person").first().click();
  await learner.waitForTimeout(300);
  await shot(learner, "phone-lobby-person-popup");
  await learner.keyboard.press("Escape");
  await learner.getByTestId("online-back").click();
  await learner.getByTestId("room-card").click();
  await learner.waitForURL(new RegExp(roomId));
  await expect(learner.getByTestId("join-btn")).toBeVisible();
  await shot(learner, "phone-gate");
  await learner.getByTestId("join-btn").click();
  await expect(learner.getByTestId("room")).toHaveAttribute("data-status", "connected", { timeout: 30_000 });

  // Extra listener raises a hand; some chat
  await guest(extra, "Linh");
  await extra.goto(`/room/${roomId}`);
  await extra.getByTestId("join-btn").click();
  await expect(extra.getByTestId("room")).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await extra.getByTestId("hand-btn").click();
  await learner.getByTestId("chat-input").fill("Hi everyone, excited to practice today");
  await learner.getByTestId("chat-send").click();
  await host.getByTestId("chat-input").fill("Welcome! Linh, you're up first. Take your time with the second sentence.");
  await host.getByTestId("chat-send").click();
  await extra.getByTestId("chat-input").fill("Thanks, I'm a bit nervous but let's go");
  await extra.getByTestId("chat-send").click();
  await learner.getByTestId("reactions-toggle").click();
  await learner.locator('[data-testid="reaction-btn"][data-emoji="👏"]').click();
  await learner.locator('[data-testid="reaction-btn"][data-emoji="❤️"]').click();
  await expect(host.getByTestId("hands-queue")).toBeVisible({ timeout: 15_000 });
  await host.waitForTimeout(800);
  await shot(host, "desktop-room-host");
  await shot(learner, "phone-room-listener");
  await learner.getByTestId("people-btn").click();
  await learner.waitForTimeout(400);
  await shot(learner, "phone-people-sheet");
  await learner.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  // Invite Linh, she turns on mic -> speaker view on phone
  await host.locator('[data-testid="hands-invite-btn"]').first().click();
  await expect(extra.getByTestId("on-stage-prompt")).toBeVisible({ timeout: 20_000 });
  await shot(extra, "phone-room-invited");
  await extra.getByTestId("mic-btn").click();
  await expect(extra.getByTestId("mic-btn")).toHaveText(/Mute/, { timeout: 20_000 });
  await extra.waitForTimeout(1500);
  await shot(extra, "phone-room-speaker");
  await host.getByTestId("change-passage").click();
  await host.waitForTimeout(400);
  await shot(host, "desktop-passage-picker");
  await host.keyboard.press("Escape");
  await host.getByTestId("people-btn").click();
  await host.waitForTimeout(400);
  await shot(host, "desktop-people-sheet");

  await Promise.all([host.context().close(), learner.context().close(), extra.context().close()]);
});
