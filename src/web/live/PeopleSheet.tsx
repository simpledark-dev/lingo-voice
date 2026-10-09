"use client";

import { useEffect, useState } from "react";
import type { LobbyPerson } from "@/core/lobby-model";
import { ActionMenu, type MenuItem } from "./ActionMenu";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import type { HostControls, LiveParticipant } from "./useLiveRoom";

function Row({ p, host, onMenu }: { p: LiveParticipant; host: HostControls | null; onMenu: (p: LiveParticipant) => void }) {
  const mic = p.microphone.published ? (p.microphone.muted ? "muted" : "live") : "none";
  return (
    <li className="lv-person" data-testid="person-row" data-identity={p.identity} data-stage-role={p.stageRole} data-hand={Boolean(p.handRaisedAt)} data-mic={mic}>
      <Avatar name={p.name} identity={p.identity} size={36} speaking={p.isSpeaking} />
      <div className="lv-person-main">
        <div className="lv-person-name">
          {p.name}
          {p.isLocal && <span className="lv-tag">you</span>}
          {p.stageRole === "host" && <span className="lv-tag lv-tag-host">host</span>}
          {p.chatMuted && <span className="lv-tag">chat muted</span>}
        </div>
        <div className="lv-person-meta">
          {p.stageRole === "listener" ? "Listening" : mic === "live" ? "Speaking" : mic === "muted" ? "On stage, muted" : "On stage"}
          {p.handRaisedAt && <span className="lv-hand-flag"><Icon name="hand" size={14} /> wants to speak</span>}
        </div>
      </div>
      {host && !p.isLocal && (
        p.stageRole === "listener" && p.handRaisedAt ? (
          <button className="lv-btn lv-btn-small lv-btn-primary" data-testid="invite-btn" onClick={() => void host.invite(p.identity)}>
            Accept
          </button>
        ) : (
          <button className="lv-iconbtn" aria-label={`Actions for ${p.name}`} data-testid="person-menu" onClick={() => onMenu(p)}>
            <Icon name="more" />
          </button>
        )
      )}
    </li>
  );
}

/** Host only: people in the lobby right now, with one-tap invites. Refreshes while open. */
function InviteFromLobby({ host }: { host: HostControls }) {
  const [people, setPeople] = useState<LobbyPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      host
        .fetchLobbyPeople()
        .then((list) => !cancelled && (setPeople(list), setError(null)))
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the lobby"));
    void load();
    const timer = setInterval(load, 5_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [host]);

  const invite = async (id: string) => {
    setSent((prev) => new Set(prev).add(id));
    try {
      await host.inviteFromLobby(id);
    } catch {
      setSent((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <>
      <h3 className="lv-group-title">In the lobby · {people?.length ?? "…"}</h3>
      {error && <p className="lv-small" style={{ color: "var(--lv-danger)" }}>{error}</p>}
      {people && people.length === 0 && <p className="lv-muted lv-small">Nobody is waiting in the lobby right now.</p>}
      {people && people.length > 0 && (
        <ul className="lv-people" data-testid="lobby-people">
          {people.map((p) => {
            const invited = Boolean(p.invitedAt) || sent.has(p.id);
            return (
              <li key={p.id} className="lv-person" data-testid="lobby-person" data-user-id={p.id} data-invited={invited}>
                <Avatar name={p.displayName} identity={p.id} size={36} />
                <div className="lv-person-main">
                  <div className="lv-person-name">{p.displayName}</div>
                  <div className="lv-person-meta">{invited ? "Invited, waiting for them to join" : "In the lobby"}</div>
                </div>
                <button className="lv-btn lv-btn-small lv-btn-primary" data-testid="lobby-invite-btn" disabled={invited} onClick={() => void invite(p.id)}>
                  {invited ? "Invited" : "Invite"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function PeopleSheet({ participants, host, onClose }: { participants: LiveParticipant[]; host: HostControls | null; onClose: () => void }) {
  const [target, setTarget] = useState<LiveParticipant | null>(null);
  const onStage = participants.filter((p) => p.stageRole !== "listener");
  const hands = participants.filter((p) => p.stageRole === "listener" && p.handRaisedAt).sort((a, b) => (a.handRaisedAt! < b.handRaisedAt! ? -1 : 1));
  const listening = participants.filter((p) => p.stageRole === "listener" && !p.handRaisedAt);

  const menuItems = (p: LiveParticipant): MenuItem[] => {
    if (!host) return [];
    const items: MenuItem[] = [];
    if (p.stageRole === "listener") items.push({ label: "Invite to speak", onSelect: () => host.invite(p.identity), testId: "menu-invite" });
    if (p.stageRole === "speaker") {
      if (p.microphone.published && !p.microphone.muted) items.push({ label: "Mute microphone", onSelect: () => host.mute(p.identity), testId: "menu-mute" });
      items.push({ label: "Remove from stage", onSelect: () => host.removeFromStage(p.identity), testId: "menu-remove-stage" });
    }
    items.push(
      p.chatMuted
        ? { label: "Allow chat", onSelect: () => host.setChatMuted(p.identity, false), testId: "menu-unmute-chat" }
        : { label: "Mute chat", onSelect: () => host.setChatMuted(p.identity, true), testId: "menu-mute-chat" },
    );
    items.push({ label: "Remove from room", onSelect: () => host.remove(p.identity), tone: "danger", testId: "menu-remove" });
    return items;
  };

  return (
    <>
      <div className="lv-sheet-backdrop" onClick={onClose} role="presentation">
        <div className="lv-sheet lv-sheet-tall" role="dialog" aria-label="People" onClick={(e) => e.stopPropagation()} data-testid="people-sheet">
          <div className="lv-sheet-head">
            <div className="lv-sheet-title">People · {participants.length}</div>
            <button className="lv-iconbtn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          <div className="lv-sheet-body">
            <h3 className="lv-group-title">On stage</h3>
            <ul className="lv-people">
              {onStage.map((p) => (
                <Row key={p.identity} p={p} host={host} onMenu={setTarget} />
              ))}
            </ul>
            {hands.length > 0 && (
              <>
                <h3 className="lv-group-title">Want to speak · {hands.length}</h3>
                <ul className="lv-people" data-testid="hands-list">
                  {hands.map((p) => (
                    <Row key={p.identity} p={p} host={host} onMenu={setTarget} />
                  ))}
                </ul>
              </>
            )}
            <h3 className="lv-group-title">Listening · {listening.length}</h3>
            {listening.length === 0 ? (
              <p className="lv-muted">Nobody is just listening right now.</p>
            ) : (
              <ul className="lv-people">
                {listening.map((p) => (
                  <Row key={p.identity} p={p} host={host} onMenu={setTarget} />
                ))}
              </ul>
            )}
            {host && <InviteFromLobby host={host} />}
          </div>
        </div>
      </div>
      {target && <ActionMenu title={target.name} subtitle={target.stageRole === "listener" ? "Listening" : "On stage"} items={menuItems(target)} onClose={() => setTarget(null)} />}
    </>
  );
}
