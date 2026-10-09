"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { InviteView, LobbyResponse, OnlineUser } from "@/core/lobby-model";
import { languageLabel } from "@/core/room-model";
import { useAccount } from "@/web/account/AccountProvider";
import { ActionMenu } from "@/web/live/ActionMenu";
import { Avatar } from "@/web/live/Avatar";
import { Icon } from "@/web/live/Icon";
import { OnlineList, OnlineSidebar, whereIs } from "./OnlinePanel";

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
  const [view, setView] = useState<"rooms" | "people">("rooms");
  const [selected, setSelected] = useState<OnlineUser | null>(null);
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
  const online = data?.online ?? [];
  const onlineCount = data?.onlineCount ?? 0;

  const personPopup = selected && (
    <ActionMenu
      title={selected.displayName}
      subtitle={whereIs(selected)}
      items={
        selected.location.kind === "room" && !selected.isMe
          ? [{ label: "Go to their room", onSelect: () => router.push(`/room/${(selected.location as { roomId: string }).roomId}`), testId: "person-go-room" }]
          : []
      }
      onClose={() => setSelected(null)}
    />
  );

  if (view === "people") {
    return (
      <main className="lv-page lv-lobby" data-testid="online-view">
        <header className="lv-lobby-head lv-lobby-head-people">
          <button className="lv-iconbtn" aria-label="Back to rooms" data-testid="online-back" onClick={() => setView("rooms")}>
            <Icon name="chevron-left" />
          </button>
          <h1>
            Online now · <span data-testid="online-count-mobile">{onlineCount}</span>
          </h1>
        </header>
        <OnlineList online={online} onSelect={setSelected} />
        {personPopup}
      </main>
    );
  }

  return (
    <main className="lv-page lv-lobby">
      <header className="lv-lobby-head">
        <div className="lv-lobby-title">
          <div className="lv-wordmark">Lingo</div>
          <h1>Live practice rooms</h1>
        </div>
        <button className="lv-btn lv-btn-small lv-online-toggle" onClick={() => setView("people")} data-testid="online-toggle" aria-label="People online">
          <Icon name="users" size={16} /> <span>{onlineCount}</span> online
        </button>
        <Link href="/create" className="lv-btn lv-btn-primary lv-btn-large lv-create-btn" data-testid="create-room-link">
          Create a room
        </Link>
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
              <h2>No available rooms</h2>
              <Link href="/create" className="lv-btn lv-btn-primary">
                Create a room
              </Link>
            </div>
          )}
          {data && data.rooms.length > 0 && (
            <ul className="lv-room-rows" data-testid="room-list">
              {data.rooms.map((room) => (
                <li key={room.id}>
                  <Link href={`/room/${room.id}`} className="lv-room-row" data-testid="room-card" data-room-id={room.id}>
                    <span className="lv-room-id" data-testid="room-number">#{room.number}</span>
                    <span className="lv-room-main">
                      <span className="lv-room-title">{room.title}</span>
                      <span className="lv-room-meta">
                        {languageLabel(room.language)} · {room.level} · {room.host.name}
                      </span>
                    </span>
                    <span className="lv-room-right">
                      <span className="lv-pill">
                        <Icon name="users" size={14} /> {room.participantCount}
                      </span>
                      <span className="lv-live-pill">
                        <span className="lv-live-dot" aria-hidden /> Live
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <OnlineSidebar online={online} count={onlineCount} onSelect={setSelected} />
      </div>

      {/* Diagnostics link, kept for now but hidden from the lobby:
      <footer className="lv-lobby-foot lv-muted lv-small">
        Having audio trouble? <Link href="/s">Run a connection test</Link>.
      </footer> */}
      {personPopup}
    </main>
  );
}
