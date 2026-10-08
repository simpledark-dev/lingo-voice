/**
 * Server-only environment handling. Secrets never leave this module except to
 * the token service. Nothing here is importable from client bundles (Next.js
 * only bundles what client components import; keep it that way).
 */
import { z } from "zod";
import type { ParticipantRole } from "@/core/types";
import { roleSchema } from "@/core/validation";

export interface ServerEnv {
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_TOKEN_TTL_SECONDS: number;
  DEFAULT_PARTICIPANT_ROLE: ParticipantRole;
}

export class ConfigError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Server misconfigured: ${issues.join("; ")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

const REQUIRED = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] as const;

const urlSchema = z
  .string()
  .trim()
  .regex(/^(wss?|https?):\/\/[^\s/]+/, "must look like wss://your-project.livekit.cloud (ws:// allowed for local dev)");

const ttlSchema = z.coerce.number().int().min(60).max(24 * 60 * 60);

type EnvSource = Record<string, string | undefined>;

export function loadServerEnv(source: EnvSource = process.env): ServerEnv {
  const issues: string[] = [];
  for (const key of REQUIRED) {
    if (!source[key] || source[key]!.trim() === "") issues.push(`${key} is not set`);
  }
  if (issues.length) throw new ConfigError(issues);

  const url = urlSchema.safeParse(source.LIVEKIT_URL);
  if (!url.success) issues.push(`LIVEKIT_URL ${url.error.issues[0]?.message ?? "is invalid"}`);

  let ttl = 7200;
  const rawTtl = source.LIVEKIT_TOKEN_TTL_SECONDS?.trim();
  if (rawTtl) {
    const parsed = ttlSchema.safeParse(rawTtl);
    if (!parsed.success) issues.push("LIVEKIT_TOKEN_TTL_SECONDS must be an integer between 60 and 86400");
    else ttl = parsed.data;
  }

  let role: ParticipantRole = "speaker";
  const rawRole = source.DEFAULT_PARTICIPANT_ROLE?.trim();
  if (rawRole) {
    const parsed = roleSchema.safeParse(rawRole);
    if (!parsed.success) issues.push("DEFAULT_PARTICIPANT_ROLE must be host, speaker or listener");
    else role = parsed.data;
  }

  if (issues.length) throw new ConfigError(issues);

  return {
    LIVEKIT_URL: url.data!,
    LIVEKIT_API_KEY: source.LIVEKIT_API_KEY!.trim(),
    LIVEKIT_API_SECRET: source.LIVEKIT_API_SECRET!.trim(),
    LIVEKIT_TOKEN_TTL_SECONDS: ttl,
    DEFAULT_PARTICIPANT_ROLE: role,
  };
}

/** Safe-to-expose configuration summary for the health endpoint (no values, only names). */
export function describeConfig(source: EnvSource = process.env): {
  configured: boolean;
  serverUrlHost: string | null;
  issues: string[];
} {
  try {
    const env = loadServerEnv(source);
    let host: string | null = null;
    try {
      host = new URL(env.LIVEKIT_URL).host;
    } catch {
      host = null;
    }
    return { configured: true, serverUrlHost: host, issues: [] };
  } catch (err) {
    return { configured: false, serverUrlHost: null, issues: err instanceof ConfigError ? err.issues : [String(err)] };
  }
}
