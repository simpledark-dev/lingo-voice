import { describeConfig } from "@/server/env";
import { apiJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health — deployment sanity check. Exposes config *names*, never values. */
export function GET(): Response {
  const config = describeConfig();
  return apiJson({
    ok: true,
    service: "lingo-voice",
    time: new Date().toISOString(),
    livekit: config,
  });
}
