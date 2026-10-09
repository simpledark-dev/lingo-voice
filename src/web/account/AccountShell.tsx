"use client";

import type { ReactNode } from "react";
import { AccountProvider, useAccount } from "./AccountProvider";
import { LoadingScreen } from "./LoadingScreen";
import { WelcomeScreen } from "./WelcomeScreen";

function Gate({ children }: { children: ReactNode }) {
  const { status, error, continueAsGuest, refresh } = useAccount();
  if (status === "loading") return <LoadingScreen />;
  if (status === "error") {
    return (
      <main className="lv-page lv-center">
        <div className="lv-card lv-endcard">
          <h1>Something went wrong</h1>
          <p className="lv-muted">{error}</p>
          <div className="lv-row">
            <button className="lv-btn lv-btn-primary" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }
  if (status === "anonymous") return <WelcomeScreen onGuest={continueAsGuest} />;
  return <>{children}</>;
}

/** Wraps a page: provides the account and shows the welcome screen until the user has one. */
export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      <Gate>{children}</Gate>
    </AccountProvider>
  );
}
