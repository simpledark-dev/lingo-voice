"use client";

import { useEffect, useState } from "react";
import { REACTIONS } from "@/core/messages";
import { languageLabel } from "@/core/room-model";
import { useIsPhone } from "@/web/hooks/useMediaQuery";
import { ActionMenu } from "./ActionMenu";
import { ChatInput, ChatMessages } from "./ChatPanel";
import { HandsQueue } from "./HandsQueue";
import { Icon } from "./Icon";
import { PassageCard } from "./PassageCard";
import { PassagePicker } from "./PassagePicker";
import { PeopleSheet } from "./PeopleSheet";
import { ReactionOverlay } from "./ReactionOverlay";
import { Stage } from "./Stage";
import { StatusBanner } from "./StatusBanner";
import type { LiveParticipant, LiveRoom } from "./useLiveRoom";
import { RemoteAudioRenderer } from "@/web/components/RemoteAudioRenderer";

type Sheet = { kind: "none" } | { kind: "people" } | { kind: "passage" } | { kind: "member"; p: LiveParticipant } | { kind: "leave" } | { kind: "confirm-end" };

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function RoomShell({ live, onLeft }: { live: LiveRoom; onLeft: () => void }) {
  const { state, metadata, participants, me, isHost, host, chat, reactions, hand } = live;
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const close = () => setSheet({ kind: "none" });
  const isPhone = useIsPhone();

  const showNotice = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((current) => (current === text ? null : current)), 2200);
  };
  const share = async () => {
    const url = window.location.origin + window.location.pathname;
    const title = metadata?.title ?? "Join my practice room";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showNotice("Link copied");
    } catch {
      // user cancelled the share sheet or clipboard is unavailable
    }
  };

  const myRole = me?.stageRole ?? (state.local?.role === "host" ? "host" : "listener");
  // On phones the passage starts open for whoever is on stage and collapsed for listeners.
  const [passageOpen, setPassageOpen] = useState(myRole !== "listener");
  useEffect(() => {
    setPassageOpen(myRole !== "listener");
  }, [myRole]);
  const onStage = participants.filter((p) => p.stageRole !== "listener").sort((a, b) => (a.stageRole === "host" ? -1 : b.stageRole === "host" ? 1 : 0));
  const hands = participants
    .filter((p) => p.stageRole === "listener" && p.handRaisedAt)
    .sort((a, b) => (a.handRaisedAt! < b.handRaisedAt! ? -1 : 1));
  const myQueuePosition = hands.findIndex((p) => p.isLocal) + 1;
  const mic = state.microphone;
  const connected = state.status === "connected";

  const primary = (() => {
    if (myRole === "listener") {
      return hand.raised
        ? { label: "Lower hand", icon: "hand" as const, onClick: () => void hand.lower(), tone: "active" as const, testId: "hand-btn", disabled: !connected }
        : { label: "Raise hand", icon: "hand" as const, onClick: () => void hand.raise(), tone: "default" as const, testId: "hand-btn", disabled: !connected };
    }
    switch (mic.state) {
      case "live":
        return { label: "Mute", icon: "mic" as const, onClick: () => void live.session.setMicrophoneEnabled(false), tone: "active" as const, testId: "mic-btn", disabled: false };
      case "muted":
        return { label: "Unmute", icon: "mic-off" as const, onClick: () => void live.session.setMicrophoneEnabled(true), tone: "default" as const, testId: "mic-btn", disabled: false };
      case "requesting":
        return { label: "Starting…", icon: "mic" as const, onClick: () => undefined, tone: "default" as const, testId: "mic-btn", disabled: true };
      case "error":
        return { label: "Retry mic", icon: "mic-off" as const, onClick: () => void live.session.setMicrophoneEnabled(true), tone: "default" as const, testId: "mic-btn", disabled: !connected };
      default:
        return { label: "Turn on mic", icon: "mic" as const, onClick: () => void live.session.setMicrophoneEnabled(true), tone: "primary" as const, testId: "mic-btn", disabled: !connected };
    }
  })();

  const leave = async () => {
    await live.leave();
    onLeft();
  };

  const endRoom = async () => {
    try {
      await host?.end();
    } catch {
      // error surfaced through actionError
    }
  };

  return (
    <div className="lv-room" data-testid="room" data-status={state.status} data-role={myRole}>
      <header className="lv-top">
        <button className="lv-iconbtn" aria-label="Leave room" data-testid="leave-btn" onClick={() => setSheet({ kind: "leave" })}>
          <Icon name="chevron-left" />
        </button>
        <div className="lv-top-main">
          <div className="lv-top-title">{metadata?.title ?? "Practice room"}</div>
          <div className="lv-top-meta">
            <span className="lv-live-pill">
              <span className="lv-live-dot" aria-hidden /> Live
            </span>
            {metadata && (
              <span className="lv-top-sub">
                {languageLabel(metadata.language)} · {metadata.level}
              </span>
            )}
          </div>
        </div>
        <button className="lv-btn lv-btn-ghost lv-people-btn" onClick={() => setSheet({ kind: "people" })} data-testid="people-btn" aria-label="People">
          <Icon name="users" size={18} /> <span>{participants.length}</span>
          {hands.length > 0 && (
            <span className="lv-hands-badge" data-testid="hands-badge" aria-label={`${hands.length} want to speak`}>
              <Icon name="hand" size={12} /> {hands.length}
            </span>
          )}
        </button>
        <button className="lv-iconbtn" aria-label="Share room link" data-testid="share-btn" onClick={() => void share()}>
          <Icon name="share" size={19} />
        </button>
        {isHost && (
          <button className="lv-btn lv-btn-small lv-end-btn" data-testid="end-room-btn" onClick={() => setSheet({ kind: "confirm-end" })}>
            End
          </button>
        )}
      </header>
      {notice && (
        <div className="lv-toast" role="status" data-testid="toast">
          {notice}
        </div>
      )}

      <StatusBanner
        state={state}
        actionError={live.actionError}
        onRejoin={() => void live.session.rejoin()}
        onEnableAudio={() => void live.session.startAudioPlayback()}
        onRetryMic={() => void live.session.setMicrophoneEnabled(true)}
        onDismissAction={live.clearActionError}
      />

      <div className="lv-body">
        <section className="lv-main">
          <Stage members={onStage} canModerate={Boolean(host)} onSelect={(p) => setSheet({ kind: "member", p })} />
          <HandsQueue hands={hands} host={host} meIdentity={state.local?.identity ?? null} />
          <PassageCard
            passage={metadata?.passage ?? null}
            canEdit={Boolean(host)}
            onEdit={() => setSheet({ kind: "passage" })}
            collapsible={isPhone}
            expanded={passageOpen}
            onToggle={() => setPassageOpen((v) => !v)}
          />
          {myRole === "speaker" && mic.state !== "live" && mic.state !== "muted" && (
            <div className="lv-prompt" data-testid="on-stage-prompt">
              <strong>You're on stage.</strong> Turn on your microphone and read the passage aloud. The host will give you feedback.
            </div>
          )}
          {myRole === "listener" && hand.raised && (
            <div className="lv-prompt lv-prompt-soft" data-testid="hand-prompt">
              Your hand is up{myQueuePosition > 0 ? `, you are ${ordinal(myQueuePosition)} in line` : ""}. The host will bring you on stage.
            </div>
          )}
        </section>
        <section className="lv-side" aria-label="Chat">
          <ChatMessages messages={chat.messages} hostIdentity={metadata?.host.identity ?? null} myIdentity={state.local?.identity ?? null} canModerate={Boolean(host)} onDelete={(id) => void chat.remove(id)} />
        </section>
        <ReactionOverlay items={reactions.floating} />
      </div>

      {reactionsOpen && (
        <div className="lv-reaction-row" data-testid="reaction-row">
          {REACTIONS.map((emoji) => (
            <button key={emoji} className="lv-reaction" data-testid="reaction-btn" data-emoji={emoji} onClick={() => void reactions.send(emoji)} aria-label={`React ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      <footer className="lv-bottom">
        <button className={`lv-btn lv-primary-action is-${primary.tone}`} onClick={primary.onClick} disabled={primary.disabled} data-testid={primary.testId} aria-pressed={primary.tone === "active"}>
          <Icon name={primary.icon} size={18} /> <span>{primary.label}</span>
        </button>
        <ChatInput canSend={chat.canSend} disabledReason={state.permissions?.canPublishData === false ? "Chat muted by host" : "Connecting…"} onSend={chat.send} placeholder="Say something" />
        <button className={`lv-iconbtn${reactionsOpen ? " is-active" : ""}`} aria-label="Reactions" aria-expanded={reactionsOpen} data-testid="reactions-toggle" onClick={() => setReactionsOpen((v) => !v)} disabled={!connected}>
          <Icon name="smile" />
        </button>
      </footer>

      <RemoteAudioRenderer session={live.session} roomGeneration={state.roomGeneration} />

      {sheet.kind === "people" && <PeopleSheet participants={participants} host={host} onClose={close} />}
      {sheet.kind === "passage" && metadata && host && (
        <PassagePicker language={metadata.language} level={metadata.level} current={metadata.passage} onPick={(p) => host.setPassage(p)} onClose={close} />
      )}
      {sheet.kind === "member" && host && (
        <ActionMenu
          title={sheet.p.name}
          subtitle="On stage"
          items={[
            ...(sheet.p.microphone.published && !sheet.p.microphone.muted ? [{ label: "Mute microphone", onSelect: () => host.mute(sheet.p.identity), testId: "menu-mute" }] : []),
            { label: "Remove from stage", onSelect: () => host.removeFromStage(sheet.p.identity), testId: "menu-remove-stage" },
            { label: "Remove from room", onSelect: () => host.remove(sheet.p.identity), tone: "danger", testId: "menu-remove" },
          ]}
          onClose={close}
        />
      )}
      {sheet.kind === "leave" && (
        <ActionMenu
          title="Leave this room?"
          subtitle={isHost ? "The room stays open for others until it is empty, unless you end it." : undefined}
          items={[
            { label: "Leave", onSelect: leave, testId: "leave-confirm" },
            ...(isHost ? [{ label: "End room for everyone", onSelect: () => setSheet({ kind: "confirm-end" }), tone: "danger" as const, testId: "leave-end" }] : []),
          ]}
          onClose={close}
        />
      )}
      {sheet.kind === "confirm-end" && (
        <ActionMenu
          title="End the room for everyone?"
          subtitle="Everyone will be disconnected and the room disappears from the lobby."
          items={[{ label: "End room", onSelect: endRoom, tone: "danger", testId: "confirm-end" }]}
          onClose={close}
        />
      )}
    </div>
  );
}
