/**
 * LiveKit room configuration tuned for many-to-many voice. Platform independent:
 * the same options object works with livekit-client on the web and with
 * @livekit/react-native (which wraps the same SDK).
 */
import {
  DefaultReconnectPolicy,
  type AudioCaptureOptions,
  type AudioPreset,
  type RoomConnectOptions,
  type RoomOptions,
  type TrackPublishDefaults,
} from "livekit-client";

/** Browser-side WebRTC audio processing. All three are standard getUserMedia constraints. */
export const VOICE_AUDIO_CAPTURE: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

/**
 * 32 kbps mono Opus. Wideband speech is transparent around 24-32 kbps; going
 * higher mostly costs downstream bandwidth for listeners without audible gain.
 */
export const VOICE_AUDIO_PRESET: AudioPreset = { maxBitrate: 32_000, priority: "high" };

export const VOICE_PUBLISH_DEFAULTS: TrackPublishDefaults = {
  audioPreset: VOICE_AUDIO_PRESET,
  /** Discontinuous transmission: almost no packets while the speaker is silent. */
  dtx: true,
  /** Redundant audio (RFC 2198): recovers single lost packets. Ignored where unsupported (Safari). */
  red: true,
  /**
   * Keep capturing while muted so unmute is instant and iOS does not re-prompt or
   * re-route audio. Trade-off: the browser's "mic in use" indicator stays on while muted.
   */
  stopMicTrackOnMute: false,
  forceStereo: false,
};

export function createVoiceRoomOptions(overrides: Partial<RoomOptions> = {}): RoomOptions {
  return {
    // Video-only optimisations; explicit so nobody wonders later.
    adaptiveStream: false,
    dynacast: false,
    audioCaptureDefaults: VOICE_AUDIO_CAPTURE,
    publishDefaults: VOICE_PUBLISH_DEFAULTS,
    stopLocalTrackOnUnpublish: true,
    /** Disconnect cleanly on tab close / refresh so others see us leave at once. */
    disconnectOnPageLeave: true,
    /** SDK-managed reconnection with exponential backoff (resume first, then full reconnect). */
    reconnectPolicy: new DefaultReconnectPolicy(),
    /** Plain <audio> element playback is the most battle-tested path on iOS Safari. */
    webAudioMix: false,
    ...overrides,
  };
}

export const VOICE_CONNECT_OPTIONS: RoomConnectOptions = {
  autoSubscribe: true,
  /** Initial join attempts handled inside the SDK before connect() rejects. */
  maxRetries: 3,
  peerConnectionTimeout: 15_000,
  websocketTimeout: 15_000,
};
