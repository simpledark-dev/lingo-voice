import { createInviteSchema } from "@/core/lobby-model";
import { sessionIdSchema } from "@/core/validation";
import { createLogger, databaseFailure, livekitFailure, readJson, roomService, zodDetails } from "@/server/api-helpers";
import { getUser } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { createInvite } from "@/server/invites";
import { getUserById } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.room-invites");

/** POST /api/rooms/:id/invites { toUserId } — host invites an online person to their room. */
export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await context.params;
  if (!sessionIdSchema.safeParse(roomId).success) return apiError(400, "invalid-request", "Invalid room id.");
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = createInviteSchema.safeParse(body.json);
  if (!parsed.success) return apiError(400, "invalid-request", "Invalid invite.", zodDetails(parsed.error));

  const svc = roomService();
  if (!svc.ok) return svc.response;

  let user;
  try {
    user = await getUser(request);
  } catch (err) {
    return databaseFailure(log, "invite.auth-failed", err);
  }
  if (!user) return apiError(401, "unauthenticated", "Sign in first.");

  let found;
  try {
    found = await svc.service.findRoom(roomId);
  } catch (err) {
    return livekitFailure(log, "invite.room-lookup-failed", err, "Could not load the room.", { roomId });
  }
  if (!found) return apiError(404, "room-not-found", "This room is not live.");
  if (found.metadata.host.identity !== user.id) return apiError(403, "not-host", "Only the host can invite people.");
  if (parsed.data.toUserId === user.id) return apiError(400, "invalid-request", "You cannot invite yourself.");

  try {
    const target = await getUserById(parsed.data.toUserId);
    if (!target) return apiError(404, "user-not-found", "That person is not around anymore.");
    const invite = await createInvite({ roomId, roomTitle: found.metadata.title, fromUserId: user.id, toUserId: target.id });
    log.info("invite.created", { roomId, from: user.id, to: target.id, inviteId: invite.id });
    return apiJson({ invite }, 201);
  } catch (err) {
    return databaseFailure(log, "invite.create-failed", err, { roomId });
  }
}
