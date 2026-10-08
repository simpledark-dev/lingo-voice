import type { ApiErrorBody, TokenRequest, TokenResponse } from "./types";

export class TokenFetchError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TokenFetchError";
    this.status = status;
    this.code = code;
  }
}

export type TokenFetcher = (request: TokenRequest, signal?: AbortSignal) => Promise<TokenResponse>;

/**
 * Token fetcher that talks to our backend over HTTP. Works in browsers and in
 * React Native (both provide fetch). `baseUrl` is "" for same-origin web, or the
 * API origin for a native app.
 */
export function createHttpTokenFetcher(baseUrl = "", fetchImpl: typeof fetch = fetch): TokenFetcher {
  return async (request, signal) => {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/api/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal,
      });
    } catch (err) {
      throw new TokenFetchError(0, "network", err instanceof Error ? err.message : "network error");
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const apiError = (body as ApiErrorBody | null)?.error;
      throw new TokenFetchError(
        response.status,
        apiError?.code ?? `http-${response.status}`,
        apiError?.message ?? `Token request failed with HTTP ${response.status}`,
      );
    }
    return body as TokenResponse;
  };
}
