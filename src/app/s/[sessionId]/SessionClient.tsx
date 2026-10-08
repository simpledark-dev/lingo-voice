"use client";

import dynamic from "next/dynamic";
import type { SessionViewProps } from "@/web/components/SessionView";

/** The RTC UI is browser-only (WebRTC, media devices), so it is never server-rendered. */
const SessionView = dynamic(() => import("@/web/components/SessionView").then((m) => m.SessionView), {
  ssr: false,
  loading: () => (
    <main className="page">
      <section className="card">
        <p className="muted">Loading voice client…</p>
      </section>
    </main>
  ),
});

export function SessionClient(props: SessionViewProps) {
  return <SessionView {...props} />;
}
