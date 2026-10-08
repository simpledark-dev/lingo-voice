"use client";

import type { VoiceSessionState } from "@/core/voice-session";
import { Icon } from "./Icon";

export function StatusBanner({ state, actionError, onRejoin, onEnableAudio, onRetryMic, onDismissAction }: { state: VoiceSessionState; actionError: string | null; onRejoin: () => void; onEnableAudio: () => void; onRetryMic: () => void; onDismissAction: () => void }) {
  const items: Array<{ key: string; tone: "info" | "warn" | "error"; text: string; action?: { label: string; onClick: () => void; testId?: string } }> = [];
  const { status, error, microphone } = state;

  if (status === "connecting") items.push({ key: "connecting", tone: "info", text: "Connecting to the room…" });
  if (status === "reconnecting") items.push({ key: "reconnecting", tone: "warn", text: "Connection interrupted. Reconnecting…" });
  if (status === "rejoining") {
    items.push({ key: "rejoining", tone: "warn", text: `Connection lost. Rejoining${state.rejoin ? ` (attempt ${state.rejoin.attempt}/${state.rejoin.maxAttempts})` : ""}…` });
  }
  if ((status === "failed" || status === "disconnected") && error && error.code !== "session-closed" && error.code !== "removed-from-session") {
    items.push({ key: "error", tone: "error", text: error.message, action: error.action === "rejoin" ? { label: "Rejoin", onClick: onRejoin, testId: "banner-rejoin" } : undefined });
  }
  if (status === "connected" && !state.audioPlayback.allowed) {
    items.push({ key: "audio", tone: "warn", text: "Tap to hear the room.", action: { label: "Enable audio", onClick: onEnableAudio, testId: "enable-audio" } });
  }
  if (microphone.state === "error" && microphone.error) {
    items.push({ key: "mic", tone: "error", text: microphone.error.message, action: { label: "Retry mic", onClick: onRetryMic, testId: "retry-mic" } });
  }
  if (microphone.silenceDetected && microphone.state === "live") {
    items.push({ key: "silent", tone: "warn", text: "Your microphone seems silent. Check the input device or a hardware mute switch." });
  }
  if (actionError) items.push({ key: "action", tone: "error", text: actionError, action: { label: "Dismiss", onClick: onDismissAction } });

  if (items.length === 0) return null;
  return (
    <div className="lv-banners" data-testid="status-banners">
      {items.map((item) => (
        <div key={item.key} className={`lv-banner lv-banner-${item.tone}`} role={item.tone === "error" ? "alert" : "status"}>
          {item.tone !== "info" && <Icon name="alert" size={16} />}
          <span>{item.text}</span>
          {item.action && (
            <button className="lv-btn lv-btn-small" onClick={item.action.onClick} data-testid={item.action.testId}>
              {item.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
