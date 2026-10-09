"use client";

import dynamic from "next/dynamic";
import { AccountShell } from "@/web/account/AccountShell";
import { LoadingScreen } from "@/web/account/LoadingScreen";

const LiveRoomPage = dynamic(() => import("@/web/live/LiveRoomPage").then((m) => m.LiveRoomPage), {
  ssr: false,
  loading: () => <LoadingScreen label="Opening the room" />,
});

export function RoomClient({ roomId }: { roomId: string }) {
  return (
    <AccountShell>
      <LiveRoomPage roomId={roomId} />
    </AccountShell>
  );
}
