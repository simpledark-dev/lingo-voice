import { createLogger, databaseFailure } from "@/server/api-helpers";
import { getOrCreateUser, withSetCookie } from "@/server/auth";
import { apiJson } from "@/server/http";
import { toPublicUser } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api.auth");

/** POST /api/auth/guest — the only place an account is created implicitly: "Continue as guest". */
export async function POST(request: Request): Promise<Response> {
  try {
    const { user, setCookie, isNew } = await getOrCreateUser(request);
    if (isNew) log.info("guest.created", { userId: user.id });
    return withSetCookie(apiJson({ user: toPublicUser(user) }, isNew ? 201 : 200), setCookie);
  } catch (err) {
    return databaseFailure(log, "guest.failed", err);
  }
}
