"use client";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import type { LiveParticipant } from "./useLiveRoom";

export function Stage({ members, canModerate, onSelect }: { members: LiveParticipant[]; canModerate: boolean; onSelect: (p: LiveParticipant) => void }) {
  return (
    <section className="lv-stage" aria-label="On stage">
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
                <span className="lv-stage-avatar">
                  <Avatar name={p.name} identity={p.identity} size={60} speaking={p.isSpeaking} />
                  <span className={`lv-stage-mic lv-stage-mic-${mic}`} aria-hidden>
                    <Icon name={mic === "live" ? "mic" : "mic-off"} size={12} />
                  </span>
                </span>
                <span className="lv-stage-name">
                  {p.isLocal ? "You" : p.name}
                </span>
                <span className={`lv-stage-role${p.stageRole === "host" ? " is-host" : ""}`}>
                  {p.stageRole === "host" ? "Host" : p.isSpeaking ? "Speaking" : mic === "muted" ? "Muted" : mic === "none" ? "Mic off" : "On stage"}
                </span>
              </Tag>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
