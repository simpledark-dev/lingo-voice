"use client";

import { useEffect } from "react";

const HEARTBEAT_MS = 20_000;

/** Reports where this user is ("lobby" or a room id) every 20 s while the page is open. */
export function usePresenceHeartbeat(location: string | null): void {
  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    const beat = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      void fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location }),
        keepalive: true,
      }).catch(() => undefined);
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [location]);
}
