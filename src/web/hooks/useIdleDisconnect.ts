"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onIdle` when the page has been hidden (other tab, app in background,
 * screen locked) for longer than `idleMs`. Background timers may be suspended on
 * phones, so the elapsed time is also checked when the page becomes visible again.
 */
export function useIdleDisconnect(active: boolean, idleMs: number, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hiddenAt: number | null = null;

    const fire = () => {
      timer = null;
      hiddenAt = null;
      onIdleRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (hiddenAt === null) {
          hiddenAt = Date.now();
          timer = setTimeout(fire, idleMs);
        }
        return;
      }
      if (timer) clearTimeout(timer);
      timer = null;
      if (hiddenAt !== null && Date.now() - hiddenAt >= idleMs) {
        hiddenAt = null;
        onIdleRef.current();
        return;
      }
      hiddenAt = null;
    };

    if (document.visibilityState === "hidden") onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [active, idleMs]);
}
