"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { InviteView, LobbyResponse } from "@/core/lobby-model";
import { languageLabel } from "@/core/room-model";
import { useAccount } from "@/web/account/AccountProvider";
import { Avatar } from "@/web/live/Avatar";
import { Icon } from "@/web/live/Icon";
import { NameEditor } from "./NameEditor";
import { OnlineList, OnlineSidebar } from "./OnlinePanel";

type LobbyState = { kind: "loading" } | { kind: "ready"; data: LobbyResponse } | { kind: "error"; message: string };

const POLL_MS = 5_000;

function InviteBanner({ invite, onRespond }: { invite: InviteView; onRespond: (invite: InviteView, action: "accept" | "decline") => void }) {
  return (
    <div className="lv-invite" role="status" data-testid="invite-banner" data-invite-id={invite.id}>
      <Avatar name={invite.from.displayName} identity={invite.from.id} size={36} />
      <div className="lv-invite-text">
        <strong>{invite.from.displayName}</strong> invited you to <strong>{invite.roomTitle}</strong>
      </div>
      <div className="lv-invite-actions">
        <button className="lv-btn lv-btn-small lv-btn-primary" data-testid="invite-join" onClick={() => onRespond(invite, "accept")}>
          Join
        </button>
        <button className="lv-btn lv-btn-small lv-btn-ghost" data-testid="invite-dismiss" onClick={() => onRespond(invite, "decline")}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function Lobby() {
  const router = useRouter();
  const account = useAccount();
  const [state, setState] = useState<LobbyState>({ kind: "loading" });
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lobby", { cache: "no-store" });
      if (res.status === 401) {
        void account.refresh(); // session vanished: the account gate takes over
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as LobbyResponse;
      setState({ kind: "ready", data });
    } catch (err) {
      setState((prev) => (prev.kind === "ready" ? prev : { kind: "error", message: err instanceof Error ? err.message : "Could not load the lobby" }));
    }
  }, [account]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      await load();
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const rename = async (name: string) => {
    await account.rename(name);
    await load();
  };

  const respond = async (invite: InviteView, action: "accept" | "decline") => {
    setHidden((prev) => new Set(prev).add(invite.id));
    void fetch(`/api/invites/${encodeURIComponent(invite.id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
      keepalive: true,
    }).catch(() => undefined);
    if (action === "accept") router.push(`/room/${invite.roomId}`);
  };

  const data = state.kind === "ready" ? state.data : null;
  const invites = (data?.invites ?? []).filter((i) => !hidden.has(i.id));

  return (
    <main className="lv-page lv-lobby">
      <header className="lv-lobby-head">
        <div>
          <div className="lv-wordmark">Lingo</div>
          <h1>Live practice rooms</h1>
          <p className="lv-muted">Listen, react, raise your hand, and read aloud with a host who gives feedback.</p>
          <NameEditor me={account.me} onRename={rename} />
        </div>
        <div className="lv-lobby-actions">
          <button className="lv-btn lv-online-toggle" onClick={() => setPeopleOpen(true)} data-testid="online-toggle" aria-label="People online">
            <Icon name="users" size={18} /> <span data-testid="online-count-mobile">{data?.onlineCount ?? "–"}</span> online
          </button>
          <Link href="/create" className="lv-btn lv-btn-primary lv-btn-large" data-testid="create-room-link">
            Create a room
          </Link>
        </div>
      </header>

      {invites.length > 0 && (
        <div className="lv-invites">
          {invites.map((invite) => (
            <InviteBanner key={invite.id} invite={invite} onRespond={respond} />
          ))}
        </div>
      )}

      <div className="lv-lobby-grid">
        <section className="lv-lobby-main">
          {state.kind === "loading" && <p className="lv-muted">Finding live rooms…</p>}
          {state.kind === "error" && (
            <div className="lv-banner lv-banner-error" role="alert">
              <Icon name="alert" size={16} /> <span>{state.message}</span>
            </div>
          )}
          {data?.roomsError && (
            <div className="lv-banner lv-banner-error" role="alert">
              <Icon name="alert" size={16} /> <span>{data.roomsError}</span>
            </div>
          )}
          {data && !data.roomsError && data.rooms.length === 0 && (
            <div className="lv-card lv-empty" data-testid="rooms-empty">
              <h2>No rooms are live right now</h2>
              <p className="lv-muted">Start one and share the link. It appears here the moment you join.</p>
              <Link href="/create" className="lv-btn lv-btn-primary">
                Create a room
              </Link>
            </div>
          )}
          {data && data.rooms.length > 0 && (
            <ul className="lv-room-grid" data-testid="room-list">
              {data.rooms.map((room) => (
                <li key={room.id}>
                  <Link href={`/room/${room.id}`} className="lv-room-card" data-testid="room-card" data-room-id={room.id}>
                    <div className="lv-room-card-top">
                      <span className="lv-pill lv-pill-live">
                        <span className="lv-live-dot" aria-hidden /> Live
                      </span>
                      <span className="lv-pill">
                        <Icon name="users" size={14} /> {room.participantCount}
                      </span>
                    </div>
                    <h2>{room.title}</h2>
                    <p className="lv-room-card-meta">
                      {languageLabel(room.language)} · {room.level}
                    </p>
                    {room.passageTitle && (
                      <p className="lv-room-card-passage">
                        <Icon name="book" size={14} /> {room.passageTitle}
                      </p>
                    )}
                    <div className="lv-room-card-host">
                      <Avatar name={room.host.name} identity={room.host.identity} size={28} />
                      <span>Hosted by {room.host.name}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <OnlineSidebar online={data?.online ?? []} count={data?.onlineCount ?? 0} />
      </div>

      <footer className="lv-lobby-foot lv-muted lv-small">
        Having audio trouble? <Link href="/s">Run a connection test</Link>.
      </footer>

      {peopleOpen && (
        <div className="lv-sheet-backdrop" onClick={() => setPeopleOpen(false)} role="presentation">
          <div className="lv-sheet lv-sheet-tall" role="dialog" aria-label="People online" onClick={(e) => e.stopPropagation()} data-testid="online-sheet">
            <div className="lv-sheet-head">
              <div className="lv-sheet-title">Online now · {data?.onlineCount ?? 0}</div>
              <button className="lv-iconbtn" onClick={() => setPeopleOpen(false)} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            <div className="lv-sheet-body">
              <OnlineList online={data?.online ?? []} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
