"use client";

import { useEffect, useRef } from "react";
import { playHandChime } from "./sound";

/** Chimes for the host whenever a new hand goes up (not for hands already up on arrival). */
export function useHandRaiseSound(handIdentities: string[], enabled: boolean): void {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!enabled) {
      seen.current = null;
      return;
    }
    const current = new Set(handIdentities);
    if (seen.current === null) {
      seen.current = current; // first observation: no sound for hands raised before we got here
      return;
    }
    let fresh = false;
    for (const id of current) if (!seen.current.has(id)) fresh = true;
    seen.current = current;
    if (fresh) playHandChime();
  }, [handIdentities.join(","), enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
