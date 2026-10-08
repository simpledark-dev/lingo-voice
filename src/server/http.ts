import type { ApiErrorBody } from "@/core/types";

export function apiError(status: number, code: string, message: string, details?: unknown): Response {
  const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function apiJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
