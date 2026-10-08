"use client";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import type { HostControls, LiveParticipant } from "./useLiveRoom";

/** Raised hands, visible to everyone in the room; the host gets one-tap invites. */
export function HandsQueue({ hands, host, meIdentity }: { hands: LiveParticipant[]; host: HostControls | null; meIdentity: string | null }) {
  if (hands.length === 0) return null;
  return (
    <section className="lv-hands" data-testid="hands-queue" aria-label="Wants to speak">
      <div className="lv-hands-head">
        <Icon name="hand" size={16} />
        <h2>Wants to speak · {hands.length}</h2>
      </div>
      <ul className="lv-hands-list">
        {hands.map((p, index) => (
          <li key={p.identity} className="lv-hands-row" data-testid="hands-row" data-identity={p.identity}>
            <span className="lv-hands-pos">{index + 1}</span>
            <Avatar name={p.name} identity={p.identity} size={30} />
            <span className="lv-hands-name">
              {p.name}
              {p.identity === meIdentity && <span className="lv-tag">you</span>}
            </span>
            {host && (
              <button className="lv-btn lv-btn-small lv-btn-primary" data-testid="hands-invite-btn" onClick={() => void host.invite(p.identity)}>
                Invite
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
