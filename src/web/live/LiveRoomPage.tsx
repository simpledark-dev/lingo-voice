"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { languageLabel, type RoomDetails } from "@/core/room-model";
import { useAccount } from "@/web/account/AccountProvider";
import { LoadingScreen } from "@/web/account/LoadingScreen";
import { useIdleDisconnect } from "@/web/hooks/useIdleDisconnect";
import { usePresenceHeartbeat } from "@/web/hooks/usePresence";
import { NameEditor } from "@/web/lobby/NameEditor";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { RoomShell } from "./RoomShell";
import { useLiveRoom } from "./useLiveRoom";

type DetailsState = { kind: "loading" } | { kind: "ready"; room: RoomDetails; idleMs: number } | { kind: "missing" } | { kind: "error"; message: string };

const DEFAULT_IDLE_MS = 10 * 60_000;

function minutesLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "a moment";
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

function EndScreen({ title, body, testId, action }: { title: string; body: string; testId: string; action?: { label: string; onClick: () => void; testId?: string } }) {
  return (
    <main className="lv-page lv-center" data-testid={testId}>
      <div className="lv-card lv-endcard">
        <h1>{title}</h1>
        <p className="lv-muted">{body}</p>
        <div className="lv-row">
          {action && (
            <button className="lv-btn lv-btn-primary" onClick={action.onClick} data-testid={action.testId}>
              {action.label}
            </button>
          )}
          <Link className="lv-btn" href="/">
            Back to rooms
          </Link>
        </div>
      </div>
    </main>
  );
}

export function LiveRoomPage({ roomId }: { roomId: string }) {
  const router = useRouter();
  const live = useLiveRoom(roomId);
  const { me, rename } = useAccount();
  const [details, setDetails] = useState<DetailsState>({ kind: "loading" });
  const [joined, setJoined] = useState(false);
  const [idleKicked, setIdleKicked] = useState(false);
  usePresenceHeartbeat(joined ? roomId : null);

  const idleMs = details.kind === "ready" ? details.idleMs : DEFAULT_IDLE_MS;
  const connectedish = joined && (live.state.status === "connected" || live.state.status === "reconnecting" || live.state.status === "rejoining");
  useIdleDisconnect(connectedish, idleMs, () => {
    setIdleKicked(true);
    void live.leave();
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${encodeURIComponent(roomId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setDetails({ kind: "missing" });
        if (!res.ok) return setDetails({ kind: "error", message: `Could not load the room (${res.status}).` });
        const body = (await res.json()) as { room: RoomDetails; idleDisconnectMs?: number };
        setDetails({ kind: "ready", room: body.room, idleMs: body.idleDisconnectMs ?? DEFAULT_IDLE_MS });
      })
      .catch(() => !cancelled && setDetails({ kind: "error", message: "Could not reach the server." }));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const { status, error } = live.state;

  if (idleKicked && status === "idle") {
    return (
      <EndScreen
        title="You were away for a while"
        body={`You were out of the room for more than ${minutesLabel(idleMs)}, so we disconnected you to keep the room light. Rejoin whenever you are back.`}
        testId="room-idle"
        action={{
          label: "Rejoin",
          testId: "idle-rejoin",
          onClick: () => {
            if (!me) return;
            setIdleKicked(false);
            setJoined(true);
            void live.join(me.displayName, me.id);
          },
        }}
      />
    );
  }

  if (error?.code === "session-closed") {
    return <EndScreen title="This room has ended" body="The host closed the room. Thanks for practicing." testId="room-ended" />;
  }
  if (error?.code === "removed-from-session") {
    return <EndScreen title="You were removed from this room" body="The host removed you. You can join another room from the lobby." testId="room-removed" />;
  }
  if (error?.code === "duplicate-identity" && status === "disconnected") {
    return (
      <EndScreen
        title="You joined from another tab"
        body="This room is open in another tab or device with the same identity. Take it back here or close this tab."
        testId="room-duplicate"
        action={{ label: "Use this tab", onClick: () => void live.session.rejoin() }}
      />
    );
  }

  if (joined && status !== "idle") {
    return (
      <RoomShell
        live={live}
        onLeft={() => {
          setJoined(false);
          router.push("/");
        }}
      />
    );
  }

  if (details.kind === "loading") return <LoadingScreen label="Opening the room" />;
  if (details.kind === "missing") {
    return <EndScreen title="This room isn't live" body="It may have ended, or the link is wrong. Live rooms appear in the lobby." testId="room-missing" />;
  }
  if (details.kind === "error") {
    return <EndScreen title="Something went wrong" body={details.message} testId="room-error" action={{ label: "Try again", onClick: () => router.refresh() }} />;
  }

  const room = details.room;
  const asHost = Boolean(me && room.host.identity === me.id);

  const join = () => {
    if (!me) return;
    setJoined(true);
    void live.join(me.displayName, me.id);
  };

  return (
    <main className="lv-page lv-center">
      <div className="lv-card lv-gate">
        <Link href="/" className="lv-backlink">
          <Icon name="chevron-left" size={16} /> All rooms
        </Link>
        <div className="lv-gate-head">
          <Avatar name={room.host.name} identity={room.host.identity} size={44} />
          <div>
            <h1 data-testid="gate-title">{room.title}</h1>
            <p className="lv-muted">
              {languageLabel(room.language)} · {room.level} · hosted by {room.host.name}
            </p>
          </div>
        </div>
        <dl className="lv-gate-facts">
          <div>
            <dt>Now in the room</dt>
            <dd>{room.participantCount}</dd>
          </div>
          <div>
            <dt>Passage</dt>
            <dd>{room.passage?.title ?? "Not chosen yet"}</dd>
          </div>
        </dl>
        <div className="lv-gate-identity">
          <span className="lv-muted lv-small">Joining as</span>
          <NameEditor me={me} onRename={rename} />
        </div>
        <button type="button" className="lv-btn lv-btn-primary lv-btn-large" data-testid="join-btn" disabled={!me} onClick={join}>
          {asHost ? "Start as host" : "Join and listen"}
        </button>
        <p className="lv-muted lv-small">
          {asHost ? "Your microphone turns on when you start. Learners raise their hand; you invite them to read." : "You join as a listener. Raise your hand when you want to read, and the host will invite you to speak."}
        </p>
      </div>
    </main>
  );
}
