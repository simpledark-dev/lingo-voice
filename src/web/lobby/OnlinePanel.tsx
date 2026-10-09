"use client";

import type { OnlineUser } from "@/core/lobby-model";
import { Avatar } from "@/web/live/Avatar";

export function whereIs(u: OnlineUser): string {
  if (u.location.kind === "lobby") return "In the lobby";
  return u.location.roomTitle ? `In ${u.location.roomTitle}` : "In a room";
}

export function OnlineList({ online, onSelect }: { online: OnlineUser[]; onSelect: (u: OnlineUser) => void }) {
  if (online.length === 0) return <p className="lv-muted lv-small">Nobody else is online right now.</p>;
  return (
    <ul className="lv-online-list" data-testid="online-list">
      {online.map((u) => (
        <li key={u.id}>
          <button
            type="button"
            className="lv-online-person"
            data-testid="online-person"
            data-user-id={u.id}
            data-location={u.location.kind}
            onClick={() => onSelect(u)}
          >
            <Avatar name={u.displayName} identity={u.id} size={30} />
            <span className="lv-online-name">
              {u.displayName}
              {u.isMe && <span className="lv-tag">you</span>}
            </span>
            {u.location.kind === "room" && <span className="lv-online-dot" aria-label="in a room" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Desktop sidebar: always visible, scrolls on its own. */
export function OnlineSidebar({ online, count, onSelect }: { online: OnlineUser[]; count: number; onSelect: (u: OnlineUser) => void }) {
  return (
    <aside className="lv-online-side" aria-label="People online">
      <div className="lv-online-head">
        <h2>Online now</h2>
        <span className="lv-pill" data-testid="online-count">
          {count}
        </span>
      </div>
      <OnlineList online={online} onSelect={onSelect} />
    </aside>
  );
}
