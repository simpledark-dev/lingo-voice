"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHAT_HISTORY_MAX,
  decodeLiveMessage,
  encodeLiveMessage,
  LIVE_TOPIC,
  newChatId,
  type ChatEntry,
  type ReactionEmoji,
} from "@/core/messages";
import {
  HAND_ATTRIBUTE_KEY,
  parseRoomMetadata,
  stageRoleOf,
  type HostAction,
  type Passage,
  type RoomMetadata,
  type StageRole,
} from "@/core/room-model";
import type { LobbyPerson } from "@/core/lobby-model";
import type { ParticipantSnapshot, VoiceSession, VoiceSessionState } from "@/core/voice-session";
import { useVoiceSession } from "@/web/hooks/useVoiceSession";
import { getOrCreateIdentity } from "@/web/storage";

export interface LiveParticipant extends ParticipantSnapshot {
  stageRole: StageRole;
  handRaisedAt: string | null;
  chatMuted: boolean;
}

export interface FloatingReaction {
  id: number;
  emoji: ReactionEmoji;
  /** horizontal offset in percent of the overlay width */
  x: number;
}

export interface HostControls {
  invite(identity: string): Promise<void>;
  removeFromStage(identity: string): Promise<void>;
  mute(identity: string): Promise<void>;
  remove(identity: string): Promise<void>;
  setChatMuted(identity: string, muted: boolean): Promise<void>;
  setPassage(passage: Passage): Promise<void>;
  end(): Promise<void>;
  /** People currently in the lobby that the host can invite. */
  fetchLobbyPeople(): Promise<LobbyPerson[]>;
  inviteFromLobby(userId: string): Promise<void>;
}

export interface LiveRoom {
  session: VoiceSession;
  state: VoiceSessionState;
  metadata: RoomMetadata | null;
  participants: LiveParticipant[];
  me: LiveParticipant | null;
  isHost: boolean;
  join(displayName: string, identity?: string): Promise<void>;
  leave(): Promise<void>;
  chat: {
    messages: ChatEntry[];
    canSend: boolean;
    send(text: string): Promise<void>;
    remove(id: string): Promise<void>;
  };
  reactions: {
    floating: FloatingReaction[];
    send(emoji: ReactionEmoji): Promise<void>;
  };
  hand: {
    raised: boolean;
    raise(): Promise<void>;
    lower(): Promise<void>;
  };
  host: HostControls | null;
  actionError: string | null;
  clearActionError(): void;
}

const MAX_CHAT = 300;
const MAX_FLOATING = 30;
const FLOAT_MS = 2600;
const REACTION_MIN_INTERVAL_MS = 150;

function appendMessage(list: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  if (list.some((m) => m.id === entry.id)) return list;
  const next = [...list, entry];
  return next.length > MAX_CHAT ? next.slice(-MAX_CHAT) : next;
}

function mergeHistory(list: ChatEntry[], history: ChatEntry[]): ChatEntry[] {
  const known = new Set(list.map((m) => m.id));
  const merged = [...list, ...history.filter((m) => !known.has(m.id))];
  merged.sort((a, b) => a.at - b.at);
  return merged.length > MAX_CHAT ? merged.slice(-MAX_CHAT) : merged;
}

export function useLiveRoom(roomId: string): LiveRoom {
  const { session, state } = useVoiceSession();
  const deviceIdentity = useMemo(() => getOrCreateIdentity(), []);
  const metadata = useMemo(() => parseRoomMetadata(state.roomMetadata), [state.roomMetadata]);
  const isHost = state.local?.role === "host";

  const participants = useMemo<LiveParticipant[]>(
    () =>
      state.participants.map((p) => ({
        ...p,
        stageRole: stageRoleOf(p.identity, metadata, p.canPublish),
        handRaisedAt: p.attributes[HAND_ATTRIBUTE_KEY] || null,
        chatMuted: metadata?.chatMuted.includes(p.identity) ?? false,
      })),
    [state.participants, metadata],
  );
  const me = participants.find((p) => p.isLocal) ?? null;

  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const hostIdentityRef = useRef<string | null>(null);
  hostIdentityRef.current = metadata?.host.identity ?? null;
  const floatSeq = useRef(0);
  const lastReactionAt = useRef(0);

  const pushFloating = useCallback((emoji: ReactionEmoji) => {
    const id = ++floatSeq.current;
    setFloating((prev) => {
      const next = [...prev, { id, emoji, x: 10 + Math.random() * 80 }];
      return next.length > MAX_FLOATING ? next.slice(-MAX_FLOATING) : next;
    });
    setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), FLOAT_MS);
  }, []);

  // Incoming data messages.
  useEffect(
    () =>
      session.onData((payload, from, topic) => {
        if (topic !== LIVE_TOPIC || !from) return;
        const message = decodeLiveMessage(payload);
        if (!message) return;
        switch (message.type) {
          case "chat":
            setMessages((prev) => appendMessage(prev, { id: message.id, text: message.text, at: message.at, from }));
            break;
          case "chat.delete":
            if (from.identity !== hostIdentityRef.current) return;
            setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, deleted: true } : m)));
            break;
          case "chat.history":
            if (from.identity !== hostIdentityRef.current) return;
            setMessages((prev) => mergeHistory(prev, message.messages));
            break;
          case "reaction":
            pushFloating(message.emoji);
            break;
        }
      }),
    [session, pushFloating],
  );

  // Host sends recent chat to newcomers so late joiners get context.
  const remoteIds = participants
    .filter((p) => !p.isLocal)
    .map((p) => p.identity)
    .sort()
    .join(",");
  const knownRemotes = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set(remoteIds ? remoteIds.split(",") : []);
    if (isHost) {
      for (const identity of current) {
        if (knownRemotes.current.has(identity)) continue;
        const timer = setTimeout(() => {
          const recent = messagesRef.current.filter((m) => !m.deleted).slice(-CHAT_HISTORY_MAX);
          if (recent.length === 0) return;
          session
            .publishData(encodeLiveMessage({ type: "chat.history", messages: recent.map(({ id, text, at, from }) => ({ id, text, at, from })) }), {
              reliable: true,
              topic: LIVE_TOPIC,
              destinationIdentities: [identity],
            })
            .catch(() => undefined);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
    knownRemotes.current = current;
  }, [remoteIds, isHost, session]);

  // Reset room-scoped UI state when the underlying room changes (leave / rejoin / ended).
  useEffect(() => {
    if (state.status === "idle") {
      setMessages([]);
      knownRemotes.current = new Set();
    }
  }, [state.status]);

  const join = useCallback(
    async (displayName: string, identity?: string) => {
      // The server replaces the identity with the account id for product rooms.
      await session.join({ sessionId: roomId, displayName, identity: identity ?? deviceIdentity });
    },
    [session, roomId, deviceIdentity],
  );

  const leave = useCallback(() => session.leave(), [session]);

  const sendChat = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !state.local) return;
      const entry: ChatEntry = {
        id: newChatId(),
        text: trimmed.slice(0, 500),
        at: Date.now(),
        from: { identity: state.local.identity, name: state.local.displayName },
      };
      try {
        await session.publishData(encodeLiveMessage({ type: "chat", id: entry.id, text: entry.text, at: entry.at }), {
          reliable: true,
          topic: LIVE_TOPIC,
        });
        setMessages((prev) => appendMessage(prev, entry));
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Could not send the message");
      }
    },
    [session, state.local],
  );

  const removeChat = useCallback(
    async (id: string) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted: true } : m)));
      try {
        await session.publishData(encodeLiveMessage({ type: "chat.delete", id }), { reliable: true, topic: LIVE_TOPIC });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Could not delete the message");
      }
    },
    [session],
  );

  const sendReaction = useCallback(
    async (emoji: ReactionEmoji) => {
      const now = Date.now();
      if (now - lastReactionAt.current < REACTION_MIN_INTERVAL_MS) return;
      lastReactionAt.current = now;
      pushFloating(emoji);
      try {
        await session.publishData(encodeLiveMessage({ type: "reaction", emoji }), { reliable: false, topic: LIVE_TOPIC });
      } catch {
        // Reactions are best-effort.
      }
    },
    [session, pushFloating],
  );

  const raiseHand = useCallback(async () => {
    try {
      await session.setAttributes({ [HAND_ATTRIBUTE_KEY]: new Date().toISOString() });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not raise your hand");
    }
  }, [session]);

  const lowerHand = useCallback(async () => {
    try {
      await session.setAttributes({ [HAND_ATTRIBUTE_KEY]: "" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not lower your hand");
    }
  }, [session]);

  const hostAction = useCallback(
    async (action: HostAction) => {
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/host`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "The action failed");
        throw err;
      }
    },
    [roomId],
  );

  const fetchLobbyPeople = useCallback(async (): Promise<LobbyPerson[]> => {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/lobby-people`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load people in the lobby (${res.status})`);
    return ((await res.json()) as { people: LobbyPerson[] }).people;
  }, [roomId]);

  const inviteFromLobby = useCallback(
    async (userId: string) => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toUserId: userId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        const message = body?.error?.message ?? `Could not send the invite (${res.status})`;
        setActionError(message);
        throw new Error(message);
      }
    },
    [roomId],
  );

  const host = useMemo<HostControls | null>(
    () =>
      isHost
        ? {
            invite: (identity) => hostAction({ action: "invite", identity }),
            removeFromStage: (identity) => hostAction({ action: "remove-from-stage", identity }),
            mute: (identity) => hostAction({ action: "mute", identity }),
            remove: (identity) => hostAction({ action: "remove-participant", identity }),
            setChatMuted: (identity, muted) => hostAction({ action: "set-chat-muted", identity, muted }),
            setPassage: (passage) => hostAction({ action: "set-passage", passage }),
            end: () => hostAction({ action: "end" }),
            fetchLobbyPeople,
            inviteFromLobby,
          }
        : null,
    [isHost, hostAction, fetchLobbyPeople, inviteFromLobby],
  );

  return {
    session,
    state,
    metadata,
    participants,
    me,
    isHost,
    join,
    leave,
    chat: {
      messages,
      canSend: state.status === "connected" && state.permissions?.canPublishData !== false,
      send: sendChat,
      remove: removeChat,
    },
    reactions: { floating, send: sendReaction },
    hand: { raised: Boolean(me?.handRaisedAt), raise: raiseHand, lower: lowerHand },
    host,
    actionError,
    clearActionError: () => setActionError(null),
  };
}
