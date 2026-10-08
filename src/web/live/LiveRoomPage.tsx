"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { languageLabel, type RoomDetails } from "@/core/room-model";
import { useAccount } from "@/web/account/AccountProvider";
import { usePresenceHeartbeat } from "@/web/hooks/usePresence";
import { NameEditor } from "@/web/lobby/NameEditor";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { RoomShell } from "./RoomShell";
import { useLiveRoom } from "./useLiveRoom";

type DetailsState = { kind: "loading" } | { kind: "ready"; room: RoomDetails } | { kind: "missing" } | { kind: "error"; message: string };

function EndScreen({ title, body, testId, action }: { title: string; body: string; testId: string; action?: { label: string; onClick: () => void } }) {
  return (
    <main className="lv-page lv-center" data-testid={testId}>
      <div className="lv-card lv-endcard">
        <h1>{title}</h1>
        <p className="lv-muted">{body}</p>
        <div className="lv-row">
          {action && (
            <button className="lv-btn lv-btn-primary" onClick={action.onClick}>
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
  usePresenceHeartbeat(joined ? roomId : null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${encodeURIComponent(roomId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setDetails({ kind: "missing" });
        if (!res.ok) return setDetails({ kind: "error", message: `Could not load the room (${res.status}).` });
        const body = (await res.json()) as { room: RoomDetails };
        setDetails({ kind: "ready", room: body.room });
      })
      .catch(() => !cancelled && setDetails({ kind: "error", message: "Could not reach the server." }));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const { status, error } = live.state;

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

  if (details.kind === "loading") {
    return (
      <main className="lv-page lv-center">
        <p className="lv-muted">Loading room…</p>
      </main>
    );
  }
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
