import { inviteResponseSchema } from "@/core/lobby-model";
import { createLogger, databaseFailure, readJson, zodDetails } from "@/server/api-helpers";
import { getUser } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { respondToInvite } from "@/server/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.invites");

/** POST /api/invites/:id { action: accept | decline } — only the invitee can respond. */
export async function POST(request: Request, context: { params: Promise<{ inviteId: string }> }): Promise<Response> {
  const { inviteId } = await context.params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = inviteResponseSchema.safeParse(body.json);
  if (!parsed.success) return apiError(400, "invalid-request", "Invalid response.", zodDetails(parsed.error));
  try {
    const user = await getUser(request);
    if (!user) return apiError(401, "unauthenticated", "Sign in first.");
    const invite = await respondToInvite(inviteId, user.id, parsed.data.action);
    if (!invite) return apiError(404, "invite-not-found", "This invite is not yours or no longer exists.");
    log.info("invite.responded", { inviteId, userId: user.id, action: parsed.data.action });
    return apiJson({ invite });
  } catch (err) {
    return databaseFailure(log, "invite.respond-failed", err, { inviteId });
  }
}
