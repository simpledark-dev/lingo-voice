"use client";

import type { SimulationScenario, VoiceSession, VoiceSessionState } from "@/core/voice-session";

const SCENARIOS: Array<{ id: SimulationScenario; label: string; hint: string }> = [
  { id: "signal-reconnect", label: "Signal reconnect", hint: "Drops the signalling socket; SDK should resume" },
  { id: "full-reconnect", label: "Full reconnect", hint: "Forces a full reconnect of media + signalling" },
  { id: "server-leave", label: "Server leave", hint: "Server disconnects us; app should rejoin with a fresh token" },
  { id: "node-failure", label: "Node failure", hint: "Simulates the media node failing" },
  { id: "speaker", label: "Speaker update", hint: "Server sends a fake active-speaker update" },
];

export function Diagnostics({ session, state }: { session: VoiceSession; state: VoiceSessionState }) {
  const connected = state.status === "connected";
  const { events: _events, ...rest } = state;
  return (
    <section className="card">
      <details>
        <summary className="section-head">
          <h2>Diagnostics</h2>
          <span className="muted small">failure simulation and raw state</span>
        </summary>
        <p className="muted small">
          These ask the LiveKit server to simulate failures so reconnection can be tested without pulling cables.
          Works against a local dev server and LiveKit Cloud.
        </p>
        <div className="button-row wrap">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              data-testid={`simulate-${s.id}`}
              disabled={!connected}
              title={s.hint}
              onClick={() => void session.simulate(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="kv-grid small">
          <div>
            <span className="muted">Server</span>
            <span className="mono">{state.server?.url ?? "–"}</span>
          </div>
          <div>
            <span className="muted">Region / node</span>
            <span className="mono">
              {state.server?.region ?? "–"} / {state.server?.nodeId ?? "–"}
            </span>
          </div>
          <div>
            <span className="muted">Server version</span>
            <span className="mono">{state.server?.version ?? "–"}</span>
          </div>
          <div>
            <span className="muted">User agent</span>
            <span className="mono">{typeof navigator !== "undefined" ? navigator.userAgent : "–"}</span>
          </div>
        </div>
        <pre className="raw" data-testid="raw-state">
          {JSON.stringify(rest, null, 2)}
        </pre>
      </details>
    </section>
  );
}
