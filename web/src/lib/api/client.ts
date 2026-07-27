import { getConnectionSession } from "@/lib/session";
import { ApiError } from "@/lib/api/errors";

export type GatewayRequestInit = RequestInit & {
  /** When true, send X-Admin-Token if present. */
  admin?: boolean;
  /** Override session gateway URL (used during connection validation). */
  gatewayUrl?: string;
  apiKey?: string;
  adminToken?: string;
  /** Fetch timeout in ms (default 30s; use higher for create/build). */
  timeoutMs?: number;
  /** Observe the raw response (e.g. to read pagination headers) before parsing. */
  onResponse?: (response: Response) => void;
};

export async function gatewayFetch<T = unknown>(
  path: string,
  init: GatewayRequestInit = {},
): Promise<T> {
  const session = await getConnectionSession();
  const gatewayUrl = init.gatewayUrl ?? session?.gatewayUrl;
  const apiKey = init.apiKey ?? session?.apiKey;
  const adminToken = init.adminToken ?? session?.adminToken;

  if (!gatewayUrl || !apiKey) {
    throw new ApiError(
      401,
      "Not connected. Configure Gateway URL and API key in Settings.",
    );
  }

  const url = `${gatewayUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", apiKey);
  if (init.admin && adminToken) {
    headers.set("X-Admin-Token", adminToken);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const timeoutMs = init.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
      cache: "no-store",
    });

    init.onResponse?.(res);

    if (!res.ok) {
      let body: unknown = undefined;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = text;
      }
      const message =
        typeof body === "object" &&
        body &&
        "message" in body &&
        typeof (body as { message: unknown }).message === "string"
          ? (body as { message: string }).message
          : res.statusText || `HTTP ${res.status}`;
      throw new ApiError(res.status, message, body);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const text = await res.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(408, "Request timed out talking to the Gateway.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
