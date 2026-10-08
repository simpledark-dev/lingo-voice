"use client";

import dynamic from "next/dynamic";

const LiveRoomPage = dynamic(() => import("@/web/live/LiveRoomPage").then((m) => m.LiveRoomPage), {
  ssr: false,
  loading: () => (
    <main className="lv-page lv-center">
      <p className="lv-muted">Loading room…</p>
    </main>
  ),
});

export function RoomClient({ roomId }: { roomId: string }) {
  return <LiveRoomPage roomId={roomId} />;
}
