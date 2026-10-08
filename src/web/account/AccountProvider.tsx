"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicUser } from "@/core/lobby-model";

export type AccountStatus = "loading" | "anonymous" | "ready" | "error";

export interface AccountValue {
  me: PublicUser | null;
  status: AccountStatus;
  error: string | null;
  /** Creates (or resumes) a guest account. The only way an account comes into existence today. */
  continueAsGuest(): Promise<void>;
  rename(name: string): Promise<void>;
  refresh(): Promise<void>;
}

const AccountContext = createContext<AccountValue | null>(null);

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res, `Could not load your account (${res.status})`));
      const body = (await res.json()) as { user: PublicUser | null };
      setMe(body.user);
      setStatus(body.user ? "ready" : "anonymous");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your account");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const continueAsGuest = useCallback(async () => {
    const res = await fetch("/api/auth/guest", { method: "POST" });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not create a guest account"));
    const body = (await res.json()) as { user: PublicUser };
    setMe(body.user);
    setStatus("ready");
  }, []);

  const rename = useCallback(async (name: string) => {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: name.trim() }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, "Could not change your name"));
    const body = (await res.json()) as { user: PublicUser };
    setMe(body.user);
  }, []);

  const value = useMemo<AccountValue>(() => ({ me, status, error, continueAsGuest, rename, refresh }), [me, status, error, continueAsGuest, rename, refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside <AccountProvider>");
  return value;
}
