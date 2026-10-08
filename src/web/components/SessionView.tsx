"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PARTICIPANT_ROLES, type ParticipantRole } from "@/core/types";
import { useVoiceSession } from "@/web/hooks/useVoiceSession";
import { getOrCreateIdentity, loadDisplayName, saveDisplayName } from "@/web/storage";
import { Diagnostics } from "./Diagnostics";
import { ErrorBanner } from "./ErrorBanner";
import { EventLog } from "./EventLog";
import { ParticipantList } from "./ParticipantList";
import { RemoteAudioRenderer } from "./RemoteAudioRenderer";
import { StatsPanel } from "./StatsPanel";

export interface SessionViewProps {
  sessionId: string;
  initialName?: string;
  initialRole?: ParticipantRole;
  autoJoin?: boolean;
}

function defaultName(identity: string): string {
  return `Guest-${identity.slice(-4)}`;
}

const STATUS_TEXT: Record<string, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Connection interrupted, reconnecting…",
  rejoining: "Connection lost, rejoining…",
  disconnected: "Disconnected",
  failed: "Could not connect",
};

export function SessionView({ sessionId, initialName, initialRole, autoJoin = false }: SessionViewProps) {
  const { session, state } = useVoiceSession();
  const identity = useMemo(() => getOrCreateIdentity(), []);
  const [displayName, setDisplayName] = useState(() => initialName?.trim() || loadDisplayName() || defaultName(identity));
  const [role, setRole] = useState<ParticipantRole>(initialRole ?? "speaker");
  const [copied, setCopied] = useState(false);
  const autoJoined = useRef(false);

  const { status, microphone: mic } = state;
  const isActive = status === "connecting" || status === "connected" || status === "reconnecting" || status === "rejoining";
  const shareUrl = `${window.location.origin}/s/${sessionId}`;

  const join = useCallback(() => {
    const name = displayName.trim() || defaultName(identity);
    saveDisplayName(name);
    void session.join({ sessionId, displayName: name, identity, role });
  }, [displayName, identity, role, session, sessionId]);

  useEffect(() => {
    if (autoJoin && !autoJoined.current) {
      autoJoined.current = true;
      join();
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable: the read-only input below can be selected manually.
    }
  };

  const enableMic = () => void session.setMicrophoneEnabled(true);
  const micButton = (() => {
    switch (mic.state) {
      case "live":
        return { label: "Mute", disabled: false, onClick: () => void session.setMicrophoneEnabled(false) };
      case "muted":
        return { label: "Unmute", disabled: false, onClick: enableMic };
      case "requesting":
        return { label: "Starting mic…", disabled: true, onClick: () => undefined };
      case "not-allowed":
        return { label: "Listening only", disabled: true, onClick: () => undefined };
      case "error":
        return { label: "Retry mic", disabled: status !== "connected", onClick: enableMic };
      default:
        return { label: "Enable mic", disabled: status !== "connected", onClick: enableMic };
    }
  })();

  const remoteCount = state.participants.filter((p) => !p.isLocal).length;
  const receiving = state.participants.filter((p) => !p.isLocal && p.microphone.subscribed).length;

  return (
    <main className="page">
      <header className="card header">
        <div>
          <div className="eyebrow">lingo-voice · test session</div>
          <h1 className="mono" data-testid="session-id">
            {sessionId}
          </h1>
        </div>
        <div className="share">
          <input className="mono" readOnly value={shareUrl} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
          <button onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
        </div>
      </header>

      <section className="card">
        <div className="status-row">
          <span className={`pill status status-${status}`} data-testid="connection-status">
            {status}
          </span>
          <span className="status-text">{STATUS_TEXT[status] ?? status}</span>
          {state.rejoin && (
            <span className="muted small" data-testid="rejoin-attempt">
              attempt {state.rejoin.attempt}/{state.rejoin.maxAttempts}
            </span>
          )}
          {state.lastDisconnectReason && status !== "connected" && (
            <span className="muted small">last reason: {state.lastDisconnectReason}</span>
          )}
        </div>
        <div className="kv-grid">
          <div>
            <span className="muted">You</span>
            <span>
              {state.local?.displayName ?? displayName} <span className="mono small muted">{state.local?.identity ?? identity}</span>
            </span>
          </div>
          <div>
            <span className="muted">Role</span>
            <span data-testid="local-role">{state.local?.role ?? role}</span>
          </div>
          <div>
            <span className="muted">Microphone</span>
            <span>
              <span className={`pill mic-${mic.state}`} data-testid="mic-state">
                {mic.state}
              </span>{" "}
              <span className="small muted">{mic.deviceLabel ?? ""}</span>
              {mic.silenceDetected && <span className="small warn-text"> silent input detected</span>}
            </span>
          </div>
          <div>
            <span className="muted">Receiving</span>
            <span data-testid="receiving-summary">
              {receiving}/{remoteCount} remote mics
            </span>
          </div>
          <div>
            <span className="muted">Server</span>
            <span className="mono small">
              {state.server ? new URL(state.server.url).host : "–"}
              {state.server?.region ? ` (${state.server.region})` : ""}
            </span>
          </div>
          <div>
            <span className="muted">Audio playback</span>
            <span data-testid="audio-playback">{state.audioPlayback.allowed ? "allowed" : "blocked"}</span>
          </div>
        </div>
      </section>

      <ErrorBanner
        error={state.error}
        micError={mic.state === "error" ? mic.error : null}
        audioBlocked={isActive && !state.audioPlayback.allowed}
        canAct={status === "connected"}
        onRejoin={() => void session.rejoin()}
        onRetryMic={enableMic}
        onEnableAudio={() => void session.startAudioPlayback()}
        onDismiss={() => session.clearError()}
      />

      <section className="card">
        {!isActive && (
          <div className="form-row">
            <label>
              Display name
              <input
                data-testid="input-name"
                value={displayName}
                maxLength={40}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Role <span className="muted small">(test only; server will decide later)</span>
              <select data-testid="select-role" value={role} onChange={(e) => setRole(e.target.value as ParticipantRole)}>
                {PARTICIPANT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="button-row">
          {isActive ? (
            <button data-testid="btn-leave" className="danger" onClick={() => void session.leave()}>
              Leave
            </button>
          ) : (
            <button data-testid="btn-join" className="primary" onClick={join} disabled={displayName.trim().length === 0}>
              {status === "failed" || status === "disconnected" ? "Rejoin" : "Join"}
            </button>
          )}
          <button data-testid="btn-mic" onClick={micButton.onClick} disabled={micButton.disabled} aria-pressed={mic.state === "live"}>
            {micButton.label}
          </button>
          {isActive && !state.audioPlayback.allowed && (
            <button className="primary" onClick={() => void session.startAudioPlayback()}>
              Enable audio
            </button>
          )}
        </div>
        {isActive && state.devices.audioinput.length > 0 && (
          <label className="device-select">
            Microphone device
            <select
              data-testid="select-mic"
              value={mic.deviceId ?? ""}
              onChange={(e) => void session.switchMicrophone(e.target.value)}
              disabled={mic.state === "requesting" || mic.state === "not-allowed"}
            >
              {mic.deviceId === null && <option value="">(default)</option>}
              {state.devices.audioinput.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <ParticipantList participants={state.participants} activeSpeakers={state.activeSpeakers} />
      <StatsPanel stats={state.stats} participants={state.participants} />
      <Diagnostics session={session} state={state} />
      <EventLog events={state.events} />
      <RemoteAudioRenderer session={session} roomGeneration={state.roomGeneration} />
    </main>
  );
}
