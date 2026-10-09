/**
 * Server-side backstop for idle disconnects. Clients disconnect themselves after
 * being hidden for the idle limit, but a suspended mobile tab never runs its timer.
 * Room pages send presence heartbeats only while visible, so a participant whose
 * last heartbeat for that room is older than the limit is removed here.
 */
import type { LingoRoomService } from "./room-service";
import type { UserRecord } from "./users";

export interface IdleSweepResult {
  checkedRooms: number;
  removed: Array<{ roomId: string; identity: string }>;
}

export interface IdleSweepDeps {
  idleMs: number;
  now?: number;
  getUsersByIds: (ids: string[]) => Promise<Map<string, UserRecord>>;
}

export async function sweepIdleParticipants(service: LingoRoomService, deps: IdleSweepDeps): Promise<IdleSweepResult> {
  const now = deps.now ?? Date.now();
  const rooms = await service.listRooms();
  const removed: IdleSweepResult["removed"] = [];
  for (const room of rooms) {
    if (room.participantCount === 0) continue;
    const identities = await service.listParticipantIdentities(room.id);
    const users = await deps.getUsersByIds(identities);
    for (const identity of identities) {
      const user = users.get(identity);
      if (!user || user.lastSeenAt === null) continue; // not an account (diagnostics session) -> leave alone
      const idleInThisRoom = user.lastLocation === room.id && now - user.lastSeenAt > deps.idleMs;
      if (!idleInThisRoom) continue;
      try {
        await service.removeParticipant(room.id, identity);
        removed.push({ roomId: room.id, identity });
      } catch {
        // Already gone; nothing to do.
      }
    }
  }
  return { checkedRooms: rooms.length, removed };
}

let lastSweepAt = Number.NEGATIVE_INFINITY;

/** Runs the sweep at most once per interval per server instance. Returns null when skipped. */
export async function maybeSweepIdle(service: LingoRoomService, deps: IdleSweepDeps, minIntervalMs = 60_000): Promise<IdleSweepResult | null> {
  const now = deps.now ?? Date.now();
  if (now - lastSweepAt < minIntervalMs) return null;
  lastSweepAt = now;
  return sweepIdleParticipants(service, deps);
}

export function resetSweepThrottleForTests(): void {
  lastSweepAt = Number.NEGATIVE_INFINITY;
}
