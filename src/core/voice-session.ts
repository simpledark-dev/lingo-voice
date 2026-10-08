/**
 * VoiceSession: platform-independent controller around a LiveKit Room.
 *
 * - Owns join / leave / rejoin, microphone publish & mute, device switching.
 * - Exposes a serialisable state snapshot (participants, mic, errors, stats, event log)
 *   through subscribe()/getSnapshot(), so React (useSyncExternalStore), React Native,
 *   or anything else can render it.
 * - Delegates reconnection to the SDK (resume / full reconnect). When the SDK gives
 *   up and the room disconnects unexpectedly, it fetches a fresh token and rejoins
 *   with bounded exponential backoff, then surfaces a manual "rejoin" action.
 *
 * It never touches the DOM. Remote audio playback is the platform layer's job
 * (see web/components/RemoteAudioRenderer.tsx); on React Native the SDK plays audio itself.
 */
import type { ParticipantPermission } from "@livekit/protocol";
import {
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  LocalAudioTrack,
  type LocalTrackPublication,
  type Participant,
  RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  Room,
  type RoomConnectOptions,
  RoomEvent,
  type RoomOptions,
  Track,
  TrackEvent,
  type TrackPublication,
} from "livekit-client";
import {
  classifyConnectError,
  classifyMicrophoneError,
  classifyTokenFetchError,
  makeError,
  type VoiceError,
} from "./errors";
import { createVoiceRoomOptions, VOICE_CONNECT_OPTIONS } from "./room-options";
import type { TokenFetcher } from "./token-client";
import {
  PARTICIPANT_ROLES,
  ROLE_ATTRIBUTE_KEY,
  type ParticipantRole,
  type SessionPermissions,
  type TokenResponse,
} from "./types";

// ---------------------------------------------------------------------------
// State model
// ---------------------------------------------------------------------------

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  /** SDK is resuming / reconnecting the existing session (temporary network loss). */
  | "reconnecting"
  /** SDK gave up; we are fetching a fresh token and joining again. */
  | "rejoining"
  /** Disconnected and not retrying automatically; user can rejoin. */
  | "disconnected"
  /** Could not (re)connect; user must act. */
  | "failed";

export type MicrophoneState =
  | "off"
  | "requesting"
  | "live"
  | "muted"
  | "error"
  /** Role does not permit publishing (listener). */
  | "not-allowed";

export interface ParticipantSnapshot {
  identity: string;
  sid: string;
  name: string;
  isLocal: boolean;
  role: ParticipantRole | null;
  canPublish: boolean | null;
  canPublishData: boolean | null;
  /** Participant attributes (e.g. raised hand). Client-set, so informational only. */
  attributes: Record<string, string>;
  connectionQuality: ConnectionQuality;
  isSpeaking: boolean;
  audioLevel: number;
  microphone: {
    published: boolean;
    muted: boolean;
    /** Remote only: whether we currently receive this participant's audio. */
    subscribed: boolean | null;
    subscriptionStatus: string | null;
    trackSid: string | null;
  };
  joinedAt: number | null;
}

export interface AudioStatsSnapshot {
  at: number;
  packets: number | null;
  packetsLost: number | null;
  bytes: number | null;
  bitrateKbps: number | null;
  jitterMs: number | null;
  rttMs: number | null;
  audioLevel: number | null;
  totalAudioEnergy: number | null;
  concealedSamples: number | null;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export type VoiceEventLevel = "info" | "warn" | "error";

export interface VoiceEvent {
  id: number;
  at: number;
  level: VoiceEventLevel;
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface VoiceSessionState {
  status: SessionStatus;
  sessionId: string | null;
  /** Raw LiveKit room metadata (product layers parse it). */
  roomMetadata: string | null;
  local: { identity: string; displayName: string; role: ParticipantRole } | null;
  permissions: SessionPermissions | null;
  server: { url: string; region: string | null; nodeId: string | null; version: string | null } | null;
  participants: ParticipantSnapshot[];
  activeSpeakers: string[];
  microphone: {
    state: MicrophoneState;
    deviceId: string | null;
    deviceLabel: string | null;
    error: VoiceError | null;
    silenceDetected: boolean;
  };
  devices: { audioinput: DeviceInfo[]; audiooutput: DeviceInfo[] };
  audioPlayback: { allowed: boolean };
  /** Session-level recoverable error (connection, token, subscription). */
  error: VoiceError | null;
  lastDisconnectReason: string | null;
  rejoin: { attempt: number; maxAttempts: number; nextAt: number } | null;
  stats: { local: AudioStatsSnapshot | null; remote: Record<string, AudioStatsSnapshot> };
  events: VoiceEvent[];
  /** Increments whenever a new underlying Room instance is created. */
  roomGeneration: number;
}

export interface JoinParams {
  sessionId: string;
  displayName: string;
  identity: string;
  role?: ParticipantRole;
  /** Host key for product rooms; the server turns it into the host role. */
  hostKey?: string;
}

export type DataPayload = Uint8Array<ArrayBuffer>;

export type DataListener = (payload: Uint8Array, from: { identity: string; name: string } | null, topic: string | undefined) => void;

export interface PublishDataOptions {
  reliable?: boolean;
  topic?: string;
  destinationIdentities?: string[];
}

export interface AutoRejoinPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface VoiceSessionOptions {
  fetchToken: TokenFetcher;
  roomOptions?: RoomOptions;
  connectOptions?: RoomConnectOptions;
  /** Rejoin with a fresh token after an unexpected disconnect. `false` disables. */
  autoRejoin?: AutoRejoinPolicy | false;
  /** Publish the microphone right after joining when the role allows it. Default true. */
  autoEnableMicrophone?: boolean;
  statsIntervalMs?: number;
  maxEvents?: number;
  now?: () => number;
  onEvent?: (event: VoiceEvent) => void;
}

export type SimulationScenario = Parameters<Room["simulateScenario"]>[0];

export const DEFAULT_AUTO_REJOIN: AutoRejoinPolicy = { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 10_000 };

export function createInitialState(): VoiceSessionState {
  return {
    status: "idle",
    sessionId: null,
    roomMetadata: null,
    local: null,
    permissions: null,
    server: null,
    participants: [],
    activeSpeakers: [],
    microphone: { state: "off", deviceId: null, deviceLabel: null, error: null, silenceDetected: false },
    devices: { audioinput: [], audiooutput: [] },
    audioPlayback: { allowed: true },
    error: null,
    lastDisconnectReason: null,
    rejoin: null,
    stats: { local: null, remote: {} },
    events: [],
    roomGeneration: 0,
  };
}

const ACTIVE_STATUSES: ReadonlySet<SessionStatus> = new Set(["connecting", "connected", "reconnecting"]);

function roleFromAttributes(attributes: Readonly<Record<string, string>>): ParticipantRole | null {
  const raw = attributes[ROLE_ATTRIBUTE_KEY];
  return raw && (PARTICIPANT_ROLES as readonly string[]).includes(raw) ? (raw as ParticipantRole) : null;
}

function disconnectReasonName(reason: DisconnectReason | undefined): string {
  if (reason === undefined) return "UNKNOWN";
  return DisconnectReason[reason] ?? String(reason);
}

type LooseStats = Record<string, number | string | undefined>;

function toSessionPermissions(p: ParticipantPermission | undefined): SessionPermissions | null {
  if (!p) return null;
  return {
    canPublish: p.canPublish,
    canSubscribe: p.canSubscribe,
    canPublishData: p.canPublishData,
    canUpdateOwnMetadata: p.canUpdateMetadata,
  };
}

/**
 * Reads inbound-rtp stats straight from the RTCRtpReceiver. The SDK's
 * getReceiverStats() omits packet counters for audio; the raw report has them,
 * plus the selected candidate pair's round-trip time.
 */
async function readInboundAudioStats(track: RemoteAudioTrack): Promise<LooseStats | undefined> {
  const receiver = track.receiver;
  if (!receiver || typeof receiver.getStats !== "function") {
    return (await track.getReceiverStats().catch(() => undefined)) as LooseStats | undefined;
  }
  try {
    const report = await receiver.getStats();
    let inbound: LooseStats | undefined;
    let rtt: number | undefined;
    report.forEach((entry: Record<string, unknown>) => {
      if (entry.type === "inbound-rtp" && (entry.kind === "audio" || entry.mediaType === "audio")) {
        inbound = entry as LooseStats;
      } else if (entry.type === "candidate-pair" && (entry.nominated === true || entry.selected === true)) {
        if (typeof entry.currentRoundTripTime === "number") rtt = entry.currentRoundTripTime;
      }
    });
    if (!inbound) return undefined;
    return rtt !== undefined ? { ...inbound, roundTripTime: rtt } : inbound;
  } catch {
    return undefined;
  }
}

function num(stats: LooseStats, key: string): number | null {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class VoiceSession {
  private readonly options: VoiceSessionOptions;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();

  private state: VoiceSessionState = createInitialState();
  private room: Room | null = null;
  private joinParams: JoinParams | null = null;
  private intentionalLeave = false;
  private joinSeq = 0;
  private rejoinAttempt = 0;
  private rejoinTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private eventSeq = 0;
  private readonly lastBytes = new Map<string, { at: number; bytes: number }>();
  private readonly dataListeners = new Set<DataListener>();

  constructor(options: VoiceSessionOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
  }

  // --- store API -----------------------------------------------------------

  readonly getSnapshot = (): VoiceSessionState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The underlying Room, for platform layers that need it (audio playback on web). */
  getRoom(): Room | null {
    return this.room;
  }

  /** Receive data messages (chat, reactions). `from` is null for server-sent data. */
  onData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  /** Send a data message to the room (or to specific identities). Throws when not connected or not permitted. */
  async publishData(payload: DataPayload, options: PublishDataOptions = {}): Promise<void> {
    const room = this.room;
    if (!room || (this.state.status !== "connected" && this.state.status !== "reconnecting")) {
      throw new Error("Not connected");
    }
    if (room.localParticipant.permissions && !room.localParticipant.permissions.canPublishData) {
      throw new Error("You are not allowed to send messages in this room");
    }
    await room.localParticipant.publishData(payload, {
      reliable: options.reliable ?? true,
      topic: options.topic,
      destinationIdentities: options.destinationIdentities,
    });
  }

  /** Set own participant attributes (requires canUpdateOwnMetadata). Empty string deletes a key. */
  async setAttributes(attributes: Record<string, string>): Promise<void> {
    const room = this.room;
    if (!room || this.state.status !== "connected") throw new Error("Not connected");
    await room.localParticipant.setAttributes(attributes);
  }

  // --- public actions ------------------------------------------------------

  async join(params: JoinParams): Promise<void> {
    this.rejoinAttempt = 0;
    await this.connectInternal(params, false);
  }

  /** Manual rejoin with a fresh token (resets the automatic attempt counter). */
  async rejoin(): Promise<void> {
    if (!this.joinParams) return;
    this.rejoinAttempt = 0;
    this.clearRejoinTimer();
    await this.connectInternal(this.joinParams, true);
  }

  /** If an automatic rejoin is pending, run it now (e.g. the device just came back online). */
  rejoinNow(): void {
    if (this.rejoinTimer && this.joinParams && this.state.status === "rejoining") {
      this.clearRejoinTimer();
      this.log("info", "rejoin.now", "Retrying immediately");
      void this.connectInternal(this.joinParams, true);
    }
  }

  async leave(): Promise<void> {
    this.intentionalLeave = true;
    this.joinSeq += 1; // supersede any in-flight join
    this.rejoinAttempt = 0;
    this.clearRejoinTimer();
    this.stopStats();
    const room = this.room;
    if (room) {
      try {
        await room.disconnect(true);
      } catch (err) {
        this.log("warn", "leave.error", "Error while disconnecting", { detail: String(err) });
      }
    }
    this.teardownRoom();
    this.setState({
      status: "idle",
      participants: [],
      activeSpeakers: [],
      rejoin: null,
      error: null,
      roomMetadata: null,
      microphone: { ...this.state.microphone, state: "off", error: null, silenceDetected: false },
      stats: { local: null, remote: {} },
    });
    this.log("info", "left", "Left the session");
  }

  /** Enable (publish / unmute) or disable (mute) the microphone. */
  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    const room = this.room;
    if (!room || !(this.state.status === "connected" || this.state.status === "reconnecting")) {
      if (enabled) {
        this.patchMicrophone({
          state: "error",
          error: makeError("not-connected", "Join the session before enabling the microphone.", "none", undefined, this.now),
        });
      }
      return;
    }
    if (enabled && this.state.permissions && !this.state.permissions.canPublish) {
      this.patchMicrophone({
        state: "not-allowed",
        error: makeError("mic-not-allowed-by-role", "Listeners cannot speak in this session.", "none", undefined, this.now),
      });
      return;
    }
    if (enabled) this.patchMicrophone({ state: "requesting", error: null });
    try {
      // Capture options come from room.audioCaptureDefaults; publish options from publishDefaults.
      await room.localParticipant.setMicrophoneEnabled(enabled);
      this.refreshMicrophoneState();
      this.log("info", enabled ? "mic.enabled" : "mic.muted", enabled ? "Microphone live" : "Microphone muted");
      if (enabled) void this.refreshDevices(); // labels become available after permission
    } catch (err) {
      const error = classifyMicrophoneError(err, this.now);
      this.patchMicrophone({ state: "error", error });
      this.log("error", "mic.failed", error.message, { code: error.code, detail: error.detail });
    }
  }

  async toggleMicrophone(): Promise<void> {
    const mic = this.state.microphone.state;
    await this.setMicrophoneEnabled(!(mic === "live"));
  }

  async switchMicrophone(deviceId: string): Promise<void> {
    const room = this.room;
    if (!room) return;
    try {
      const ok = await room.switchActiveDevice("audioinput", deviceId, true);
      this.refreshMicrophoneState();
      this.log(ok ? "info" : "warn", "mic.switch", ok ? "Switched microphone" : "Microphone switch had no effect", {
        deviceId,
      });
    } catch (err) {
      const error = makeError(
        "mic-switch-failed",
        "Could not switch to that microphone. It may have been disconnected.",
        "retry-mic",
        err,
        this.now,
      );
      this.patchMicrophone({ error });
      this.log("error", "mic.switch-failed", error.message, { detail: error.detail });
    }
  }

  async refreshDevices(): Promise<void> {
    try {
      const [audioinput, audiooutput] = await Promise.all([
        Room.getLocalDevices("audioinput", false),
        Room.getLocalDevices("audiooutput", false),
      ]);
      const toInfo = (d: MediaDeviceInfo): DeviceInfo => ({ deviceId: d.deviceId, label: d.label, kind: d.kind });
      this.setState({ devices: { audioinput: audioinput.map(toInfo), audiooutput: audiooutput.map(toInfo) } });
      this.refreshMicrophoneState();
    } catch (err) {
      this.log("warn", "devices.failed", "Could not list media devices", { detail: String(err) });
    }
  }

  /** Must be called from a user gesture on browsers that block autoplay (iOS Safari). */
  async startAudioPlayback(): Promise<void> {
    const room = this.room;
    if (!room) return;
    try {
      await room.startAudio();
      this.setState({ audioPlayback: { allowed: room.canPlaybackAudio } });
      this.log("info", "audio.started", "Audio playback enabled");
    } catch (err) {
      this.setState({
        audioPlayback: { allowed: room.canPlaybackAudio },
        error: makeError(
          "audio-playback-blocked",
          "The browser blocked audio playback. Tap 'Enable audio' again.",
          "enable-audio",
          err,
          this.now,
        ),
      });
      this.log("error", "audio.blocked", "Audio playback blocked by the browser", { detail: String(err) });
    }
  }

  /** Ask the server to simulate a failure scenario (for reliability testing). */
  async simulate(scenario: SimulationScenario): Promise<void> {
    const room = this.room;
    if (!room) return;
    this.log("warn", "simulate", `Simulating "${scenario}"`);
    await room.simulateScenario(scenario);
  }

  clearError(): void {
    this.setState({ error: null });
  }

  destroy(): void {
    void this.leave();
  }

  // --- connection lifecycle -------------------------------------------------

  private async connectInternal(params: JoinParams, isRejoin: boolean): Promise<void> {
    if (!isRejoin && ACTIVE_STATUSES.has(this.state.status)) {
      this.log("warn", "join.ignored", `Join ignored while ${this.state.status}`);
      return;
    }
    const seq = ++this.joinSeq;
    this.intentionalLeave = false;
    this.clearRejoinTimer();
    this.joinParams = params;
    this.stopStats();
    this.teardownRoom();

    this.setState({
      status: isRejoin ? "rejoining" : "connecting",
      sessionId: params.sessionId,
      error: isRejoin ? this.state.error : null,
      participants: [],
      activeSpeakers: [],
      stats: { local: null, remote: {} },
      microphone: { ...this.state.microphone, state: "off", silenceDetected: false },
    });
    this.log("info", isRejoin ? "rejoin.start" : "join.start", isRejoin ? "Rejoining session" : "Joining session", {
      sessionId: params.sessionId,
      identity: params.identity,
      attempt: isRejoin ? this.rejoinAttempt : undefined,
    });

    let tokenRes: TokenResponse;
    try {
      tokenRes = await this.options.fetchToken({
        sessionId: params.sessionId,
        displayName: params.displayName,
        identity: params.identity,
        role: params.role,
        hostKey: params.hostKey,
      });
    } catch (err) {
      if (seq !== this.joinSeq) return;
      const error = classifyTokenFetchError(err, this.now);
      this.log("error", "token.failed", error.message, { detail: error.detail });
      this.handleJoinFailure(error, isRejoin);
      return;
    }
    if (seq !== this.joinSeq) return;

    this.setState({
      local: { identity: tokenRes.identity, displayName: tokenRes.displayName, role: tokenRes.role },
      permissions: tokenRes.permissions,
      server: { url: tokenRes.serverUrl, region: null, nodeId: null, version: null },
    });
    this.log("info", "token.ok", "Token received", {
      identity: tokenRes.identity,
      role: tokenRes.role,
      expiresAt: tokenRes.expiresAt,
    });

    const room = new Room(this.options.roomOptions ?? createVoiceRoomOptions());
    this.room = room;
    this.attachRoomHandlers(room);
    this.setState({ roomGeneration: this.state.roomGeneration + 1, audioPlayback: { allowed: room.canPlaybackAudio } });

    try {
      await room.connect(tokenRes.serverUrl, tokenRes.token, this.options.connectOptions ?? VOICE_CONNECT_OPTIONS);
    } catch (err) {
      if (seq !== this.joinSeq) return;
      const error = classifyConnectError(err, this.now);
      this.log("error", "connect.failed", error.message, { detail: error.detail });
      this.teardownRoom();
      this.handleJoinFailure(error, isRejoin);
      return;
    }
    if (seq !== this.joinSeq) {
      // Superseded by leave() or a newer join while we were connecting.
      void room.disconnect(true);
      return;
    }

    const info = room.serverInfo;
    this.rejoinAttempt = 0;
    this.setState({
      status: "connected",
      error: null,
      rejoin: null,
      lastDisconnectReason: null,
      server: {
        url: tokenRes.serverUrl,
        region: info?.region ?? null,
        nodeId: info?.nodeId ?? null,
        version: info?.version ?? null,
      },
      participants: this.snapshotParticipants(room),
      audioPlayback: { allowed: room.canPlaybackAudio },
      roomMetadata: room.metadata ?? null,
      permissions: toSessionPermissions(room.localParticipant.permissions) ?? tokenRes.permissions,
    });
    this.log("info", "connected", `Connected to "${room.name}"`, {
      region: info?.region,
      participants: room.numParticipants,
      canPublish: tokenRes.permissions.canPublish,
    });

    this.startStats();
    void this.refreshDevices();

    if (this.options.autoEnableMicrophone !== false) {
      if (tokenRes.permissions.canPublish) {
        await this.setMicrophoneEnabled(true);
      } else {
        this.patchMicrophone({ state: "not-allowed", error: null });
      }
    }
  }

  private handleJoinFailure(error: VoiceError, isRejoin: boolean): void {
    if (isRejoin) {
      this.scheduleRejoin(error);
      return;
    }
    this.setState({ status: "failed", error });
  }

  private handleDisconnected(reason: DisconnectReason | undefined): void {
    const reasonName = disconnectReasonName(reason);
    // A failed connect() handles its own error path.
    if (this.state.status === "connecting" || this.state.status === "rejoining") {
      this.log("warn", "disconnected.during-connect", `Disconnected while connecting (${reasonName})`);
      return;
    }
    this.stopStats();
    this.lastBytes.clear();
    this.setState({
      participants: [],
      activeSpeakers: [],
      lastDisconnectReason: reasonName,
      microphone: { ...this.state.microphone, state: "off", silenceDetected: false },
      stats: { local: null, remote: {} },
    });

    if (this.intentionalLeave || reason === DisconnectReason.CLIENT_INITIATED) {
      this.log("info", "disconnected", `Disconnected (${reasonName})`);
      this.teardownRoom();
      this.setState({ status: "idle", rejoin: null });
      return;
    }

    this.log("warn", "disconnected", `Disconnected unexpectedly (${reasonName})`);
    this.teardownRoom();

    switch (reason) {
      case DisconnectReason.DUPLICATE_IDENTITY:
        this.setState({
          status: "disconnected",
          rejoin: null,
          error: makeError(
            "duplicate-identity",
            "This participant joined from another tab or device, so this connection was closed. Rejoin here to take over.",
            "rejoin",
            reasonName,
            this.now,
          ),
        });
        return;
      case DisconnectReason.PARTICIPANT_REMOVED:
        this.setState({
          status: "disconnected",
          rejoin: null,
          error: makeError("removed-from-session", "You were removed from the session.", "none", reasonName, this.now),
        });
        return;
      case DisconnectReason.ROOM_DELETED:
      case DisconnectReason.ROOM_CLOSED:
        this.setState({
          status: "disconnected",
          rejoin: null,
          error: makeError("session-closed", "The session has ended.", "none", reasonName, this.now),
        });
        return;
      case DisconnectReason.USER_REJECTED:
      case DisconnectReason.USER_UNAVAILABLE:
      case DisconnectReason.SIP_TRUNK_FAILURE:
        this.setState({
          status: "disconnected",
          rejoin: null,
          error: makeError("disconnected", `Disconnected (${reasonName}).`, "rejoin", reasonName, this.now),
        });
        return;
      default:
        // SIGNAL_CLOSE, STATE_MISMATCH, SERVER_SHUTDOWN, JOIN_FAILURE, MIGRATION,
        // CONNECTION_TIMEOUT, MEDIA_FAILURE, UNKNOWN_REASON: transient -> rejoin.
        this.scheduleRejoin(
          makeError("disconnected", `Connection lost (${reasonName}). Reconnecting…`, "rejoin", reasonName, this.now),
        );
    }
  }

  private scheduleRejoin(error: VoiceError): void {
    const policy = this.options.autoRejoin === undefined ? DEFAULT_AUTO_REJOIN : this.options.autoRejoin;
    if (!policy || !this.joinParams) {
      this.setState({ status: "disconnected", error, rejoin: null });
      return;
    }
    if (this.rejoinAttempt >= policy.maxAttempts) {
      const final = makeError(
        "reconnect-failed",
        `Could not reconnect after ${policy.maxAttempts} attempts. Check your connection and rejoin.`,
        "rejoin",
        error.detail,
        this.now,
      );
      this.setState({ status: "failed", error: final, rejoin: null });
      this.log("error", "rejoin.gave-up", final.message);
      return;
    }
    this.rejoinAttempt += 1;
    const base = Math.min(policy.baseDelayMs * 2 ** (this.rejoinAttempt - 1), policy.maxDelayMs);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    const nextAt = this.now() + delay;
    this.setState({
      status: "rejoining",
      error,
      rejoin: { attempt: this.rejoinAttempt, maxAttempts: policy.maxAttempts, nextAt },
    });
    this.log("warn", "rejoin.scheduled", `Rejoin attempt ${this.rejoinAttempt}/${policy.maxAttempts} in ${delay} ms`);
    this.rejoinTimer = setTimeout(() => {
      this.rejoinTimer = null;
      if (this.joinParams) void this.connectInternal(this.joinParams, true);
    }, delay);
  }

  private clearRejoinTimer(): void {
    if (this.rejoinTimer) {
      clearTimeout(this.rejoinTimer);
      this.rejoinTimer = null;
    }
  }

  private teardownRoom(): void {
    const room = this.room;
    if (!room) return;
    room.removeAllListeners();
    this.room = null;
  }

  // --- room event wiring ---------------------------------------------------

  private attachRoomHandlers(room: Room): void {
    const refresh = () => this.refreshParticipants();
    const nameOf = (p: Participant) => p.name || p.identity;

    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      this.log("info", "connection.state", `Connection state: ${state}`);
      if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
        if (this.state.status === "connected" || this.state.status === "reconnecting") {
          this.setState({ status: "reconnecting" });
        }
      } else if (state === ConnectionState.Connected && this.state.status === "reconnecting") {
        this.setState({ status: "connected" });
      }
    });
    room.on(RoomEvent.Reconnecting, () => {
      this.log("warn", "reconnecting", "Connection interrupted, reconnecting…");
    });
    room.on(RoomEvent.SignalReconnecting, () => {
      this.log("warn", "signal.reconnecting", "Signal connection lost, resuming…");
    });
    room.on(RoomEvent.Reconnected, () => {
      this.log("info", "reconnected", "Reconnected");
      this.setState({
        status: "connected",
        error: null,
        audioPlayback: { allowed: room.canPlaybackAudio },
        participants: this.snapshotParticipants(room),
      });
      this.refreshMicrophoneState();
    });
    room.on(RoomEvent.SignalConnected, () => {
      this.log("info", "signal.connected", "Signal connected");
    });
    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => this.handleDisconnected(reason));

    room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
      this.log("info", "participant.joined", `${nameOf(p)} joined`, { identity: p.identity });
      refresh();
    });
    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant, reason?: DisconnectReason) => {
      this.log("info", "participant.left", `${nameOf(p)} left (${disconnectReasonName(reason)})`, {
        identity: p.identity,
      });
      const remote = { ...this.state.stats.remote };
      delete remote[p.identity];
      this.lastBytes.delete(p.identity);
      this.setState({ stats: { ...this.state.stats, remote } });
      refresh();
    });
    room.on(RoomEvent.ParticipantNameChanged, refresh);
    room.on(RoomEvent.ParticipantAttributesChanged, refresh);
    room.on(RoomEvent.ParticipantPermissionsChanged, (_prev: ParticipantPermission | undefined, p: Participant) => {
      refresh();
      if (p !== room.localParticipant) return;
      const permissions = toSessionPermissions(p.permissions);
      if (!permissions) return;
      this.setState({ permissions });
      const mic = this.state.microphone.state;
      if (!permissions.canPublish && mic !== "not-allowed") {
        // LiveKit unpublishes our track server-side; reflect it immediately.
        this.patchMicrophone({ state: "not-allowed", error: null, silenceDetected: false });
      } else if (permissions.canPublish && mic === "not-allowed") {
        this.patchMicrophone({ state: "off", error: null });
      }
      this.log("info", "permissions", `Permissions changed: publish=${permissions.canPublish} data=${permissions.canPublishData}`);
    });
    room.on(RoomEvent.RoomMetadataChanged, (metadata: string) => {
      this.setState({ roomMetadata: metadata });
      this.log("info", "room.metadata", "Room metadata updated");
      refresh();
    });
    room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      const from = participant ? { identity: participant.identity, name: participant.name || participant.identity } : null;
      for (const listener of this.dataListeners) {
        try {
          listener(payload, from, topic);
        } catch (err) {
          this.log("warn", "data.listener-error", "Data listener threw", { detail: String(err) });
        }
      }
    });

    room.on(RoomEvent.TrackPublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
      this.log("info", "track.published", `${nameOf(p)} published ${pub.source}`, { identity: p.identity });
      refresh();
    });
    room.on(RoomEvent.TrackUnpublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
      this.log("info", "track.unpublished", `${nameOf(p)} unpublished ${pub.source}`, { identity: p.identity });
      refresh();
    });
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      this.log("info", "track.subscribed", `Receiving ${track.kind} from ${nameOf(p)}`, { identity: p.identity });
      refresh();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      this.log("info", "track.unsubscribed", `Stopped receiving ${track.kind} from ${nameOf(p)}`, {
        identity: p.identity,
      });
      refresh();
    });
    room.on(RoomEvent.TrackSubscriptionStatusChanged, refresh);
    room.on(RoomEvent.TrackSubscriptionFailed, (trackSid: string, p: RemoteParticipant, reason?: unknown) => {
      const error = makeError(
        "subscription-failed",
        `Could not receive audio from ${nameOf(p)}. Rejoin if you cannot hear them.`,
        "rejoin",
        `trackSid=${trackSid} reason=${String(reason)}`,
        this.now,
      );
      this.setState({ error });
      this.log("error", "track.subscription-failed", error.message, { identity: p.identity, detail: error.detail });
      refresh();
    });
    room.on(RoomEvent.TrackMuted, (pub: TrackPublication, p: Participant) => {
      this.log("info", "track.muted", `${nameOf(p)} muted ${pub.source}`, { identity: p.identity });
      refresh();
      if (p === room.localParticipant) this.refreshMicrophoneState();
    });
    room.on(RoomEvent.TrackUnmuted, (pub: TrackPublication, p: Participant) => {
      this.log("info", "track.unmuted", `${nameOf(p)} unmuted ${pub.source}`, { identity: p.identity });
      refresh();
      if (p === room.localParticipant) this.refreshMicrophoneState();
    });

    room.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
      this.log("info", "mic.published", `Published local ${pub.source}`);
      this.watchLocalTrack(pub);
      this.refreshMicrophoneState();
      refresh();
    });
    room.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
      this.log("info", "mic.unpublished", `Unpublished local ${pub.source}`);
      this.refreshMicrophoneState();
      refresh();
    });
    room.on(RoomEvent.LocalAudioSilenceDetected, () => {
      this.patchMicrophone({ silenceDetected: true });
      this.log("warn", "mic.silent", "Your microphone looks silent. Check the input device, hardware mute switch, or OS permissions.");
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      this.setState({ activeSpeakers: speakers.map((s) => s.identity) });
      refresh();
    });
    room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, p: Participant) => {
      if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) {
        this.log("warn", "quality", `${nameOf(p)} connection quality: ${quality}`, { identity: p.identity });
      }
      refresh();
    });

    room.on(RoomEvent.MediaDevicesChanged, () => {
      this.log("info", "devices.changed", "Media devices changed");
      void this.refreshDevices();
    });
    room.on(RoomEvent.MediaDevicesError, (err: Error, kind?: MediaDeviceKind) => {
      const error = classifyMicrophoneError(err, this.now);
      this.patchMicrophone({ state: "error", error });
      this.log("error", "devices.error", `${kind ?? "device"} error: ${error.message}`, { detail: error.detail });
    });
    room.on(RoomEvent.ActiveDeviceChanged, (kind: MediaDeviceKind, deviceId: string) => {
      this.log("info", "devices.active", `Active ${kind}: ${deviceId}`);
      if (kind === "audioinput") this.refreshMicrophoneState();
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => {
      this.setState({ audioPlayback: { allowed: playing } });
      this.log(playing ? "info" : "warn", "audio.playback", playing ? "Audio playback allowed" : "Audio playback blocked until user gesture");
      if (playing && this.state.error?.code === "audio-playback-blocked") this.setState({ error: null });
    });
  }

  private watchLocalTrack(pub: LocalTrackPublication): void {
    const track = pub.track;
    if (!track || track.kind !== Track.Kind.Audio) return;
    track.on(TrackEvent.Ended, () => {
      this.log("warn", "mic.ended", "Microphone track ended (device removed or interrupted by the OS); SDK will try to restart it");
      this.refreshMicrophoneState();
    });
    track.on(TrackEvent.Restarted, () => {
      this.log("info", "mic.restarted", "Microphone track restarted");
      this.patchMicrophone({ silenceDetected: false, error: null });
      this.refreshMicrophoneState();
      void this.refreshDevices();
    });
    track.on(TrackEvent.UpstreamPaused, () => this.log("warn", "mic.upstream-paused", "Microphone upstream paused"));
    track.on(TrackEvent.UpstreamResumed, () => this.log("info", "mic.upstream-resumed", "Microphone upstream resumed"));
  }

  // --- snapshots -----------------------------------------------------------

  private refreshParticipants(): void {
    const room = this.room;
    if (!room) return;
    this.setState({ participants: this.snapshotParticipants(room) });
  }

  private snapshotParticipants(room: Room): ParticipantSnapshot[] {
    const list: ParticipantSnapshot[] = [this.snapshotParticipant(room.localParticipant, true)];
    for (const p of room.remoteParticipants.values()) list.push(this.snapshotParticipant(p, false));
    return list;
  }

  private snapshotParticipant(p: Participant, isLocal: boolean): ParticipantSnapshot {
    const pub = p.getTrackPublication(Track.Source.Microphone);
    const remotePub = !isLocal && pub ? (pub as RemoteTrackPublication) : null;
    return {
      identity: p.identity,
      sid: p.sid,
      name: p.name || p.identity,
      isLocal,
      role: roleFromAttributes(p.attributes),
      canPublish: p.permissions ? p.permissions.canPublish : null,
      canPublishData: p.permissions ? p.permissions.canPublishData : null,
      attributes: { ...p.attributes },
      connectionQuality: p.connectionQuality,
      isSpeaking: p.isSpeaking,
      audioLevel: p.audioLevel,
      microphone: {
        published: Boolean(pub),
        muted: pub?.isMuted ?? false,
        subscribed: remotePub ? remotePub.isSubscribed : null,
        subscriptionStatus: remotePub ? remotePub.subscriptionStatus : null,
        trackSid: pub?.trackSid ?? null,
      },
      joinedAt: p.joinedAt ? p.joinedAt.getTime() : null,
    };
  }

  private refreshMicrophoneState(): void {
    const room = this.room;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const deviceId = room.getActiveDevice("audioinput") ?? null;
    const device = deviceId ? this.state.devices.audioinput.find((d) => d.deviceId === deviceId) : undefined;
    const current = this.state.microphone;
    let state: MicrophoneState = current.state;
    if (!pub) {
      if (current.state === "live" || current.state === "muted") state = "off";
    } else if (current.state !== "requesting" || pub.track) {
      state = pub.isMuted ? "muted" : "live";
    }
    this.patchMicrophone({
      state,
      deviceId,
      deviceLabel: device?.label ?? null,
      error: state === "live" || state === "muted" ? null : current.error,
    });
  }

  // --- stats ---------------------------------------------------------------

  private startStats(): void {
    this.stopStats();
    const interval = this.options.statsIntervalMs ?? 2_000;
    this.statsTimer = setInterval(() => {
      void this.collectStats();
    }, interval);
  }

  private stopStats(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private async collectStats(): Promise<void> {
    const room = this.room;
    if (!room || this.state.status !== "connected") return;
    const at = this.now();
    let local: AudioStatsSnapshot | null = null;
    const localTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    if (localTrack instanceof LocalAudioTrack) {
      const raw = (await localTrack.getSenderStats().catch(() => undefined)) as LooseStats | undefined;
      if (raw) local = this.toStatsSnapshot("local", at, raw, "packetsSent", "bytesSent");
    }
    const remote: Record<string, AudioStatsSnapshot> = {};
    for (const p of room.remoteParticipants.values()) {
      const track = p.getTrackPublication(Track.Source.Microphone)?.track;
      if (track instanceof RemoteAudioTrack) {
        const raw = await readInboundAudioStats(track);
        if (raw) remote[p.identity] = this.toStatsSnapshot(p.identity, at, raw, "packetsReceived", "bytesReceived");
      }
    }
    if (this.room !== room) return;
    this.setState({ stats: { local, remote } });
  }

  private toStatsSnapshot(key: string, at: number, raw: LooseStats, packetsKey: string, bytesKey: string): AudioStatsSnapshot {
    const bytes = num(raw, bytesKey);
    let bitrateKbps: number | null = null;
    if (bytes !== null) {
      const prev = this.lastBytes.get(key);
      if (prev && at > prev.at && bytes >= prev.bytes) {
        bitrateKbps = Math.round(((bytes - prev.bytes) * 8) / (at - prev.at));
      }
      this.lastBytes.set(key, { at, bytes });
    }
    const jitter = num(raw, "jitter");
    const rtt = num(raw, "roundTripTime");
    return {
      at,
      packets: num(raw, packetsKey),
      packetsLost: num(raw, "packetsLost"),
      bytes,
      bitrateKbps,
      jitterMs: jitter !== null ? Math.round(jitter * 1000) : null,
      rttMs: rtt !== null ? Math.round(rtt * 1000) : null,
      audioLevel: num(raw, "audioLevel"),
      totalAudioEnergy: num(raw, "totalAudioEnergy"),
      concealedSamples: num(raw, "concealedSamples"),
    };
  }

  // --- state helpers -------------------------------------------------------

  private setState(patch: Partial<VoiceSessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private patchMicrophone(patch: Partial<VoiceSessionState["microphone"]>): void {
    this.setState({ microphone: { ...this.state.microphone, ...patch } });
  }

  private log(level: VoiceEventLevel, type: string, message: string, data?: Record<string, unknown>): void {
    const event: VoiceEvent = { id: ++this.eventSeq, at: this.now(), level, type, message, data };
    const max = this.options.maxEvents ?? 200;
    const events = this.state.events.length >= max ? this.state.events.slice(-(max - 1)) : this.state.events.slice();
    events.push(event);
    this.setState({ events });
    this.options.onEvent?.(event);
  }
}
