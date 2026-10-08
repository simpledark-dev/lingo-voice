"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicUser } from "@/core/lobby-model";

/** The current (guest) account. Visiting any page creates one; the cookie keeps it. */
export function useMe(): { me: PublicUser | null; error: string | null; rename(name: string): Promise<void>; setMe(user: PublicUser): void } {
  const [me, setMe] = useState<PublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load your account (${res.status})`);
        const body = (await res.json()) as { user: PublicUser };
        if (!cancelled) setMe(body.user);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load your account"));
    return () => {
      cancelled = true;
    };
  }, []);

  const rename = useCallback(async (name: string) => {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: name.trim() }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? "Could not change your name");
    }
    const body = (await res.json()) as { user: PublicUser };
    setMe(body.user);
  }, []);

  return { me, error, rename, setMe };
}
