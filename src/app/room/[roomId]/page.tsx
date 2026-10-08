import Link from "next/link";
import { isValidSessionId } from "@/core/validation";
import { RoomClient } from "./RoomClient";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!isValidSessionId(roomId)) {
    return (
      <main className="lv-page lv-center">
        <div className="lv-card lv-endcard">
          <h1>Invalid room link</h1>
          <Link className="lv-btn" href="/">
            Back to rooms
          </Link>
        </div>
      </main>
    );
  }
  return <RoomClient roomId={roomId} />;
}
