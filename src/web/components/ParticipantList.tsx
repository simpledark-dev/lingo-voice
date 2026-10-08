"use client";

import type { ParticipantSnapshot } from "@/core/voice-session";

function micLabel(p: ParticipantSnapshot): "live" | "muted" | "none" {
  if (!p.microphone.published) return "none";
  return p.microphone.muted ? "muted" : "live";
}

export function ParticipantList({ participants, activeSpeakers }: { participants: ParticipantSnapshot[]; activeSpeakers: string[] }) {
  return (
    <section className="card">
      <div className="section-head">
        <h2>Participants</h2>
        <span className="muted" data-testid="participant-count">
          {participants.length}
        </span>
      </div>
      {participants.length === 0 ? (
        <p className="muted">Not connected.</p>
      ) : (
        <ul className="participants">
          {participants.map((p) => {
            const mic = micLabel(p);
            const speaking = p.isSpeaking || activeSpeakers.includes(p.identity);
            return (
              <li
                key={p.identity}
                className={`participant${speaking ? " speaking" : ""}`}
                data-testid="participant-row"
                data-identity={p.identity}
                data-local={p.isLocal}
                data-mic={mic}
                data-speaking={speaking}
                data-subscribed={p.microphone.subscribed === null ? "n/a" : String(p.microphone.subscribed)}
                data-role={p.role ?? "unknown"}
              >
                <div className="participant-main">
                  <div className="participant-name">
                    <span className={`dot dot-${mic}`} aria-hidden />
                    <strong>{p.name}</strong>
                    {p.isLocal && <span className="tag">you</span>}
                    {p.role && <span className="tag">{p.role}</span>}
                  </div>
                  <div className="mono small muted">{p.identity}</div>
                </div>
                <div className="participant-meta">
                  <span className={`pill mic-${mic}`}>{mic === "none" ? "no mic" : mic}</span>
                  {!p.isLocal && (
                    <span className={`pill ${p.microphone.subscribed ? "ok" : "muted-pill"}`}>
                      {p.microphone.published ? (p.microphone.subscribed ? "receiving" : "not subscribed") : "nothing to receive"}
                    </span>
                  )}
                  <span className={`pill quality-${p.connectionQuality}`}>{p.connectionQuality}</span>
                  <span className={`pill ${speaking ? "speaking-pill" : "muted-pill"}`}>{speaking ? "speaking" : "quiet"}</span>
                </div>
                <div className="level">
                  <div className="level-bar" style={{ width: `${Math.min(100, Math.round(p.audioLevel * 100))}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
