/**
 * User-facing, recoverable error model. Platform independent: the web UI and a
 * future native UI render these the same way. Classification helpers translate
 * browser / SDK exceptions into this model.
 */
import { ConnectionError, ConnectionErrorReason, MediaDeviceFailure, PublishTrackError } from "livekit-client";

export type VoiceErrorCode =
  | "token-fetch-failed"
  | "token-rejected"
  | "server-unreachable"
  | "connect-timeout"
  | "connect-failed"
  | "reconnect-failed"
  | "disconnected"
  | "duplicate-identity"
  | "removed-from-session"
  | "session-closed"
  | "mic-permission-denied"
  | "mic-not-found"
  | "mic-in-use"
  | "mic-insecure-context"
  | "mic-not-allowed-by-role"
  | "mic-publish-failed"
  | "mic-failed"
  | "mic-switch-failed"
  | "subscription-failed"
  | "audio-playback-blocked"
  | "not-connected";

/** What the UI should offer the user to recover. */
export type VoiceErrorAction = "rejoin" | "retry-mic" | "enable-audio" | "check-permissions" | "none";

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
  action: VoiceErrorAction;
  /** Short technical detail for the debug UI / logs. */
  detail?: string;
  at: number;
}

function detailOf(err: unknown): string | undefined {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return undefined;
  }
}

export function makeError(
  code: VoiceErrorCode,
  message: string,
  action: VoiceErrorAction,
  cause?: unknown,
  now: () => number = Date.now,
): VoiceError {
  return { code, message, action, detail: detailOf(cause), at: now() };
}

/** Errors thrown while acquiring / publishing the microphone. */
export function classifyMicrophoneError(err: unknown, now?: () => number): VoiceError {
  const name = err instanceof Error ? err.name : "";
  if (name === "SecurityError") {
    return makeError(
      "mic-insecure-context",
      "Microphone access requires HTTPS (or localhost). Open the page over https://.",
      "none",
      err,
      now,
    );
  }
  if (err instanceof PublishTrackError) {
    return makeError(
      "mic-publish-failed",
      "Your microphone was captured but could not be published. Retry, or rejoin the session.",
      "retry-mic",
      err,
      now,
    );
  }
  const failure = MediaDeviceFailure.getFailure(err);
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return makeError(
        "mic-permission-denied",
        "Microphone permission was denied. Allow the microphone for this site in your browser settings, then retry.",
        "check-permissions",
        err,
        now,
      );
    case MediaDeviceFailure.NotFound:
      return makeError(
        "mic-not-found",
        "No microphone was found. Connect a microphone or headset, then retry.",
        "retry-mic",
        err,
        now,
      );
    case MediaDeviceFailure.DeviceInUse:
      return makeError(
        "mic-in-use",
        "The microphone could not be started. Another app may be using it. Close it, then retry.",
        "retry-mic",
        err,
        now,
      );
    default:
      return makeError("mic-failed", "The microphone could not be started. Retry.", "retry-mic", err, now);
  }
}

/** Errors thrown by Room.connect(). */
export function classifyConnectError(err: unknown, now?: () => number): VoiceError {
  if (err instanceof ConnectionError) {
    switch (err.reason) {
      case ConnectionErrorReason.NotAllowed:
        return makeError(
          "token-rejected",
          "The server rejected the join token. Rejoin to request a new one.",
          "rejoin",
          err,
          now,
        );
      case ConnectionErrorReason.Timeout:
        return makeError(
          "connect-timeout",
          "Connecting to the voice server timed out. Check your network and rejoin.",
          "rejoin",
          err,
          now,
        );
      case ConnectionErrorReason.ServerUnreachable:
      case ConnectionErrorReason.WebSocket:
        return makeError(
          "server-unreachable",
          "The voice server could not be reached. Check your network and rejoin.",
          "rejoin",
          err,
          now,
        );
      case ConnectionErrorReason.Cancelled:
      case ConnectionErrorReason.LeaveRequest:
      default:
        return makeError("connect-failed", "Could not connect to the voice server. Rejoin.", "rejoin", err, now);
    }
  }
  return makeError("connect-failed", "Could not connect to the voice server. Rejoin.", "rejoin", err, now);
}

/** Errors thrown while fetching a token from our own backend. */
export function classifyTokenFetchError(err: unknown, now?: () => number): VoiceError {
  const message =
    err instanceof Error && err.message
      ? `Could not get a join token: ${err.message}`
      : "Could not get a join token from the server.";
  return makeError("token-fetch-failed", message, "rejoin", err, now);
}
