import { updateMeSchema } from "@/core/lobby-model";
import { createLogger, databaseFailure, readJson, zodDetails } from "@/server/api-helpers";
import { getUser } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { toPublicUser, updateDisplayName } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.me");

/** GET /api/me — the current account, or `{ user: null }` when not signed in. */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getUser(request);
    return apiJson({ user: user ? toPublicUser(user) : null });
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
    const user = await getUser(request);
    if (!user) return apiError(401, "unauthenticated", "Sign in first.");
    const updated = await updateDisplayName(user.id, parsed.data.displayName);
    return apiJson({ user: toPublicUser(updated ?? user) });
  } catch (err) {
    return databaseFailure(log, "me.update-failed", err);
  }
}
