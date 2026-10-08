"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { languageLabel, type RoomSummary } from "@/core/room-model";
import { Avatar } from "@/web/live/Avatar";
import { Icon } from "@/web/live/Icon";

type LobbyState = { kind: "loading" } | { kind: "ready"; rooms: RoomSummary[] } | { kind: "error"; message: string };

const POLL_MS = 5_000;

export function Lobby() {
  const [state, setState] = useState<LobbyState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as { rooms: RoomSummary[] };
        if (!cancelled) setState({ kind: "ready", rooms: body.rooms });
      } catch (err) {
        if (!cancelled) setState({ kind: "error", message: err instanceof Error ? err.message : "Could not load rooms" });
      } finally {
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    };
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <main className="lv-page lv-lobby">
      <header className="lv-lobby-head">
        <div>
          <div className="lv-wordmark">Lingo</div>
          <h1>Live practice rooms</h1>
          <p className="lv-muted">Listen, react, raise your hand, and read aloud with a host who gives feedback.</p>
        </div>
        <Link href="/create" className="lv-btn lv-btn-primary lv-btn-large" data-testid="create-room-link">
          Create a room
        </Link>
      </header>

      {state.kind === "loading" && <p className="lv-muted">Finding live rooms…</p>}
      {state.kind === "error" && (
        <div className="lv-banner lv-banner-error" role="alert">
          <Icon name="alert" size={16} /> <span>{state.message}</span>
        </div>
      )}
      {state.kind === "ready" && state.rooms.length === 0 && (
        <div className="lv-card lv-empty" data-testid="rooms-empty">
          <h2>No rooms are live right now</h2>
          <p className="lv-muted">Start one and share the link. It appears here the moment you join.</p>
          <Link href="/create" className="lv-btn lv-btn-primary">
            Create a room
          </Link>
        </div>
      )}
      {state.kind === "ready" && state.rooms.length > 0 && (
        <ul className="lv-room-grid" data-testid="room-list">
          {state.rooms.map((room) => (
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

      <footer className="lv-lobby-foot lv-muted lv-small">
        Having audio trouble? <Link href="/s">Run a connection test</Link>.
      </footer>
    </main>
  );
}
