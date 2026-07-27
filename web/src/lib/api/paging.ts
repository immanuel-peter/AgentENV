import { gatewayFetch } from "@/lib/api/client";

/**
 * Cursor pagination helper. The list endpoints return the cursor for the next
 * page in the `x-next-token` response header rather than in the body.
 */
export type Page<T> = {
  items: T[];
  nextToken?: string;
};

export const DEFAULT_PAGE_LIMIT = 25;

/** Maximum accepted by the `limit` parameter in `src/api/openapi.yml`. */
export const MAX_PAGE_LIMIT = 100;

export function pageQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function clampLimit(
  value: number | undefined,
  fallback = DEFAULT_PAGE_LIMIT,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.trunc(value)));
}

export async function gatewayFetchPage<T>(
  path: string,
  timeoutMs = 30_000,
): Promise<Page<T>> {
  let nextToken: string | undefined;
  const items = await gatewayFetch<T[]>(path, {
    timeoutMs,
    onResponse: (response) => {
      nextToken = response.headers.get("x-next-token") ?? undefined;
    },
  });

  return {
    items: Array.isArray(items) ? items : [],
    nextToken: nextToken || undefined,
  };
}
