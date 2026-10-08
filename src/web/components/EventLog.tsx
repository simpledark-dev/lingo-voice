"use client";

import type { VoiceEvent } from "@/core/voice-session";

function time(at: number): string {
  const d = new Date(at);
  return d.toLocaleTimeString(undefined, { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export function EventLog({ events }: { events: VoiceEvent[] }) {
  const recent = events.slice(-120).reverse();
  return (
    <section className="card">
      <details open>
        <summary className="section-head">
          <h2>Event log</h2>
          <span className="muted small">{events.length} events</span>
        </summary>
        {recent.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ol className="events" data-testid="event-log">
            {recent.map((e) => (
              <li key={e.id} className={`event event-${e.level}`}>
                <span className="mono small muted">{time(e.at)}</span>
                <span className="mono small event-type">{e.type}</span>
                <span className="event-msg">{e.message}</span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}
