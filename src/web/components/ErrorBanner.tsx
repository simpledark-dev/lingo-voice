"use client";

import type { VoiceError } from "@/core/errors";

interface Props {
  error: VoiceError | null;
  micError: VoiceError | null;
  audioBlocked: boolean;
  canAct: boolean;
  onRejoin: () => void;
  onRetryMic: () => void;
  onEnableAudio: () => void;
  onDismiss: () => void;
}

function ActionButton({ error, canAct, onRejoin, onRetryMic, onEnableAudio }: Omit<Props, "micError" | "audioBlocked" | "onDismiss"> & { error: VoiceError }) {
  switch (error.action) {
    case "rejoin":
      return (
        <button data-testid="btn-rejoin" className="primary" onClick={onRejoin}>
          Rejoin
        </button>
      );
    case "retry-mic":
    case "check-permissions":
      return (
        <button data-testid="btn-retry-mic" className="primary" onClick={onRetryMic} disabled={!canAct}>
          Retry mic
        </button>
      );
    case "enable-audio":
      return (
        <button className="primary" onClick={onEnableAudio}>
          Enable audio
        </button>
      );
    default:
      return null;
  }
}

export function ErrorBanner(props: Props) {
  const { error, micError, audioBlocked, onDismiss } = props;
  if (!error && !micError && !audioBlocked) return null;
  return (
    <section className="banners">
      {audioBlocked && (
        <div className="banner warn" data-testid="audio-blocked">
          <div>
            <strong>Audio is blocked by the browser.</strong> Tap to hear other participants.
          </div>
          <button data-testid="btn-enable-audio" className="primary" onClick={props.onEnableAudio}>
            Enable audio
          </button>
        </div>
      )}
      {error && (
        <div className="banner error" data-testid="error-banner" data-code={error.code}>
          <div>
            <strong>{error.message}</strong>
            {error.detail && <div className="mono small muted">{error.detail}</div>}
          </div>
          <div className="banner-actions">
            <ActionButton {...props} error={error} />
            <button onClick={onDismiss} aria-label="Dismiss">
              Dismiss
            </button>
          </div>
        </div>
      )}
      {micError && micError !== error && (
        <div className="banner error" data-testid="mic-error-banner" data-code={micError.code}>
          <div>
            <strong>{micError.message}</strong>
            {micError.detail && <div className="mono small muted">{micError.detail}</div>}
          </div>
          <div className="banner-actions">
            <ActionButton {...props} error={micError} />
          </div>
        </div>
      )}
    </section>
  );
}
