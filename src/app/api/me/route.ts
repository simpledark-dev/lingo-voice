import { updateMeSchema } from "@/core/lobby-model";
import { createLogger, databaseFailure, readJson, zodDetails } from "@/server/api-helpers";
import { getOrCreateUser, withSetCookie } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { toPublicUser, updateDisplayName } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.me");

/** GET /api/me — the current account; creates a guest account (and its cookie) on first visit. */
export async function GET(request: Request): Promise<Response> {
  try {
    const { user, setCookie, isNew } = await getOrCreateUser(request);
    if (isNew) log.info("guest.created", { userId: user.id });
    return withSetCookie(apiJson({ user: toPublicUser(user) }), setCookie);
  } catch (err) {
    return databaseFailure(log, "me.failed", err);
  }
}

/** PATCH /api/me — rename. */
export async function PATCH(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = updateMeSchema.safeParse(body.json);
  if (!parsed.success) return apiError(400, "invalid-request", "Invalid profile update.", zodDetails(parsed.error));
  try {
    const { user, setCookie } = await getOrCreateUser(request);
    const updated = await updateDisplayName(user.id, parsed.data.displayName);
    return withSetCookie(apiJson({ user: toPublicUser(updated ?? user) }), setCookie);
  } catch (err) {
    return databaseFailure(log, "me.update-failed", err);
  }
}
