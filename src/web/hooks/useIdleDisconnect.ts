"use client";

import { useCallback, useEffect, useRef } from "react";

/** Liveness ticks: frequent enough that "inactive for" is always well below the idle limit. */
const tickIntervalFor = (idleMs: number) => Math.max(1_000, Math.min(15_000, Math.floor(idleMs / 4)));

export interface IdleTracker {
  /** Milliseconds since this page last showed signs of life (visible tick or visibility change). */
  inactiveFor(): number;
}

/**
 * Calls `onIdle` when the page has been hidden (other tab, app in background,
 * screen locked) for longer than `idleMs`, or when the device evidently slept
 * with the page visible (the clock jumped by more than `idleMs` between ticks).
 * Background timers may be suspended on phones, so the elapsed time is also
 * checked when the page becomes visible again.
 */
export function useIdleDisconnect(active: boolean, idleMs: number, onIdle: () => void): IdleTracker {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;
  const lastAliveRef = useRef(Date.now());

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hiddenAt: number | null = null;
    lastAliveRef.current = Date.now();

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
      const away = hiddenAt !== null ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (away >= idleMs) {
        onIdleRef.current();
        return;
      }
      lastAliveRef.current = Date.now();
    };
    // Sleep detection: a visible page whose ticks stop for longer than the limit was suspended.
    const tick = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        if (now - lastAliveRef.current > idleMs) {
          lastAliveRef.current = now;
          onIdleRef.current();
          return;
        }
        lastAliveRef.current = now;
      }
    }, tickIntervalFor(idleMs));

    if (document.visibilityState === "hidden") onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(tick);
      if (timer) clearTimeout(timer);
    };
  }, [active, idleMs]);

  const inactiveFor = useCallback(() => Date.now() - lastAliveRef.current, []);
  return { inactiveFor };
}
