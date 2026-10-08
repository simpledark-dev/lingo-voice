import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateGuestName } from "@/core/guest-names";
import { createSession, getOrCreateUser, getUser, getUserForToken, parseCookies, readSessionToken, SESSION_COOKIE } from "./auth";
import { resetDbForTests } from "./db";
import { createInvite, listPendingInvitesFor, listPendingInvitesForRoom, respondToInvite } from "./invites";
import { createGuestUser, getUserById, listOnlineUsers, touchPresence, updateDisplayName } from "./users";

beforeEach(() => {
  process.env.DATABASE_URL = ":memory:";
  resetDbForTests();
});
afterEach(() => {
  resetDbForTests();
  delete process.env.DATABASE_URL;
});

describe("guest accounts", () => {
  it("creates guests with a friendly generated name and a LiveKit-safe id", async () => {
    const user = await createGuestUser();
    expect(user.id).toMatch(/^u-[a-z0-9]{16}$/);
    expect(user.displayName.split(" ")).toHaveLength(2);
    expect((await getUserById(user.id))?.displayName).toBe(user.displayName);
    expect(generateGuestName(() => 0)).toBe("Brave Otter");
  });

  it("renames", async () => {
    const user = await createGuestUser("Old Name");
    const updated = await updateDisplayName(user.id, "Minh");
    expect(updated?.displayName).toBe("Minh");
  });

  it("sessions resolve to users via cookie or bearer token and expire", async () => {
    const user = await createGuestUser();
    const { token } = await createSession(user.id, 1_000);
    expect((await getUserForToken(token, 2_000))?.id).toBe(user.id);
    expect(await getUserForToken(token, 1_000 + 366 * 24 * 3600 * 1000)).toBeNull();
    expect(await getUserForToken("nope", 2_000)).toBeNull();

    const viaCookie = new Request("http://x/", { headers: { cookie: `a=b; ${SESSION_COOKIE}=${token}` } });
    expect(readSessionToken(viaCookie)).toBe(token);
    const viaBearer = new Request("http://x/", { headers: { authorization: `Bearer ${token}` } });
    expect(readSessionToken(viaBearer)).toBe(token);
    expect(parseCookies("x=1; y=hello%20there")).toEqual({ x: "1", y: "hello there" });
  });

  it("getOrCreateUser creates a guest once and then recognises the cookie", async () => {
    const first = await getOrCreateUser(new Request("http://localhost/api/me"));
    expect(first.isNew).toBe(true);
    expect(first.setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(first.setCookie).toContain("HttpOnly");
    expect(first.setCookie).not.toContain("Secure"); // http request
    const token = /lingo_session=([^;]+)/.exec(first.setCookie!)![1]!;
    const second = await getOrCreateUser(new Request("http://localhost/api/me", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }));
    expect(second.isNew).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(await getUser(new Request("http://localhost/"))).toBeNull();
    const https = await getOrCreateUser(new Request("https://lingo.example/api/me"));
    expect(https.setCookie).toContain("Secure");
  });
});

describe("presence", () => {
  it("lists users seen within the window with their location", async () => {
    const a = await createGuestUser("A", 0);
    const b = await createGuestUser("B", 0);
    await touchPresence(a.id, "lobby", 100_000);
    await touchPresence(b.id, "en-room", 10_000);
    const online = await listOnlineUsers(110_000);
    expect(online.map((u) => u.id)).toEqual([a.id]);
    expect(online[0]!.lastLocation).toBe("lobby");
  });
});

describe("invites", () => {
  it("creates, lists, de-duplicates, and lets only the invitee respond", async () => {
    const host = await createGuestUser("Host");
    const guest = await createGuestUser("Guest");
    const other = await createGuestUser("Other");
    const invite = await createInvite({ roomId: "en-abc", roomTitle: "Room", fromUserId: host.id, toUserId: guest.id }, 1_000);
    const again = await createInvite({ roomId: "en-abc", roomTitle: "Room", fromUserId: host.id, toUserId: guest.id }, 2_000);
    expect(again.id).toBe(invite.id);
    expect((await listPendingInvitesFor(guest.id, 3_000)).map((i) => i.id)).toEqual([invite.id]);
    expect((await listPendingInvitesForRoom("en-abc", 3_000)).map((i) => i.toUserId)).toEqual([guest.id]);
    expect(await listPendingInvitesFor(guest.id, 1_000 + 3 * 60_000)).toEqual([]); // expired

    expect(await respondToInvite(invite.id, other.id, "accept")).toBeNull();
    const accepted = await respondToInvite(invite.id, guest.id, "accept", 4_000);
    expect(accepted?.status).toBe("accepted");
    expect(await listPendingInvitesFor(guest.id, 5_000)).toEqual([]);
  });
});
