/**
 * Idle policy for rooms: a participant whose room tab has been hidden (other tab,
 * app in background, screen locked) for longer than this is disconnected to stop
 * paying LiveKit minutes for nobody. Lobby presence is not affected.
 */
export const DEFAULT_ROOM_IDLE_MS = 10 * 60_000;

export function roomIdleDisconnectMs(source: Record<string, string | undefined> = process.env): number {
  const raw = source.ROOM_IDLE_DISCONNECT_MS?.trim();
  const value = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(value) && value >= 1_000 ? value : DEFAULT_ROOM_IDLE_MS;
}
