"use client";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import type { LiveParticipant } from "./useLiveRoom";

export function Stage({ members, canModerate, onSelect }: { members: LiveParticipant[]; canModerate: boolean; onSelect: (p: LiveParticipant) => void }) {
  return (
    <section className="lv-stage" aria-label="On stage">
      <div className="lv-stage-head">
        <h2>On stage</h2>
        <span className="lv-muted">{members.length === 1 ? "Host only" : `${members.length} speaking`}</span>
      </div>
      <ul className="lv-stage-list">
        {members.map((p) => {
          const mic = p.microphone.published ? (p.microphone.muted ? "muted" : "live") : "none";
          const interactive = canModerate && !p.isLocal;
          const Tag = interactive ? "button" : "div";
          return (
            <li key={p.identity}>
              <Tag
                className={`lv-stage-member${p.isSpeaking ? " is-speaking" : ""}`}
                data-testid="stage-member"
                data-identity={p.identity}
                data-mic={mic}
                data-speaking={p.isSpeaking}
                onClick={interactive ? () => onSelect(p) : undefined}
                aria-label={interactive ? `Actions for ${p.name}` : undefined}
              >
                <Avatar name={p.name} identity={p.identity} size={56} speaking={p.isSpeaking} />
                <span className={`lv-stage-mic lv-stage-mic-${mic}`} aria-hidden>
                  <Icon name={mic === "live" ? "mic" : "mic-off"} size={13} />
                </span>
                <span className="lv-stage-name">
                  {p.name}
                  {p.isLocal && <span className="lv-stage-you"> (you)</span>}
                </span>
                <span className="lv-stage-role">{p.stageRole === "host" ? "Host" : mic === "none" ? "Mic off" : mic === "muted" ? "Muted" : "Speaking"}</span>
              </Tag>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
