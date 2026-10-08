import { presenceSchema } from "@/core/lobby-model";
import { createLogger, databaseFailure, readJson, zodDetails } from "@/server/api-helpers";
import { getUser } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { touchPresence } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.presence");

/** POST /api/presence { location: "lobby" | <roomId> } — heartbeat, every ~20 s while a page is open. */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = presenceSchema.safeParse(body.json);
  if (!parsed.success) return apiError(400, "invalid-request", "Invalid presence update.", zodDetails(parsed.error));
  try {
    const user = await getUser(request);
    if (!user) return apiError(401, "unauthenticated", "Sign in first.");
    await touchPresence(user.id, parsed.data.location);
    return apiJson({ ok: true });
  } catch (err) {
    return databaseFailure(log, "presence.failed", err);
  }
}
