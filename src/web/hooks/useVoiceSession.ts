"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createHttpTokenFetcher } from "@/core/token-client";
import { createInitialState, VoiceSession, type VoiceSessionState } from "@/core/voice-session";

declare global {
  interface Window {
    /** Debug handle: inspect `__lingoVoice.getSnapshot()` in the console; used by e2e tests. */
    __lingoVoice?: VoiceSession;
  }
}

const SERVER_SNAPSHOT = createInitialState();
const getServerSnapshot = () => SERVER_SNAPSHOT;

/**
 * Binds a VoiceSession to React and to browser lifecycle signals that the SDK
 * cannot see on its own (coming back online, returning to the foreground).
 */
export function useVoiceSession(): { session: VoiceSession; state: VoiceSessionState } {
  const ref = useRef<VoiceSession | null>(null);
  if (!ref.current) {
    ref.current = new VoiceSession({
      fetchToken: createHttpTokenFetcher(""),
      onEvent: (event) => {
        if (event.level === "error") console.error("[voice]", event.type, event.message, event.data ?? "");
        else if (event.level === "warn") console.warn("[voice]", event.type, event.message, event.data ?? "");
        else console.debug("[voice]", event.type, event.message, event.data ?? "");
      },
    });
  }
  const session = ref.current;
  const mounted = useRef(false);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, getServerSnapshot);

  useEffect(() => {
    mounted.current = true;
    window.__lingoVoice = session;
    const onOnline = () => session.rejoinNow();
    const onVisibility = () => {
      if (document.visibilityState === "visible") session.rejoinNow();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      // React StrictMode (dev) runs cleanup + re-run synchronously; only tear the
      // session down if the component is still unmounted a tick later.
      queueMicrotask(() => {
        if (mounted.current) return;
        if (window.__lingoVoice === session) delete window.__lingoVoice;
        session.destroy();
      });
    };
  }, [session]);

  return { session, state };
}
