"use client";

import type { OnlineUser } from "@/core/lobby-model";
import { Avatar } from "@/web/live/Avatar";

function where(u: OnlineUser): string {
  if (u.location.kind === "lobby") return "In the lobby";
  return u.location.roomTitle ? `In ${u.location.roomTitle}` : "In a room";
}

export function OnlineList({ online }: { online: OnlineUser[] }) {
  if (online.length === 0) return <p className="lv-muted lv-small">Nobody else is online right now.</p>;
  return (
    <ul className="lv-online-list" data-testid="online-list">
      {online.map((u) => (
        <li key={u.id} className="lv-online-person" data-testid="online-person" data-user-id={u.id} data-location={u.location.kind}>
          <Avatar name={u.displayName} identity={u.id} size={30} />
          <div className="lv-online-main">
            <div className="lv-online-name">
              {u.displayName}
              {u.isMe && <span className="lv-tag">you</span>}
            </div>
            <div className="lv-online-where">{where(u)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Desktop sidebar: always visible, scrolls on its own. */
export function OnlineSidebar({ online, count }: { online: OnlineUser[]; count: number }) {
  return (
    <aside className="lv-online-side" aria-label="People online">
      <div className="lv-online-head">
        <h2>Online now</h2>
        <span className="lv-pill" data-testid="online-count">
          {count}
        </span>
      </div>
      <OnlineList online={online} />
    </aside>
  );
}
