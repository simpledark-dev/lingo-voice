"use client";

import { RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { useEffect, useRef } from "react";
import type { VoiceSession } from "@/core/voice-session";

/**
 * Plays every subscribed remote audio track through a hidden <audio> element.
 * This is the only place the voice core meets the DOM; React Native gets
 * playback from its LiveKit SDK instead.
 */
export function RemoteAudioRenderer({ session, roomGeneration }: { session: VoiceSession; roomGeneration: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const room = session.getRoom();
    const container = containerRef.current;
    if (!room || !container) return;

    const attach = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      if (track.attachedElements.length > 0) return;
      const element = track.attach();
      element.setAttribute("data-track-sid", track.sid ?? "");
      container.appendChild(element);
    };
    const detach = (track: RemoteTrack) => {
      for (const element of track.detach()) element.remove();
    };

    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        if (publication.track) attach(publication.track as RemoteTrack);
      }
    }
    room.on(RoomEvent.TrackSubscribed, attach);
    room.on(RoomEvent.TrackUnsubscribed, detach);

    return () => {
      room.off(RoomEvent.TrackSubscribed, attach);
      room.off(RoomEvent.TrackUnsubscribed, detach);
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.audioTrackPublications.values()) {
          if (publication.track) detach(publication.track as RemoteTrack);
        }
      }
      container.replaceChildren();
    };
  }, [session, roomGeneration]);

  return <div ref={containerRef} className="audio-sink" aria-hidden />;
}
