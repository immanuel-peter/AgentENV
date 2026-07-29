import {
  deriveConnectionStatus,
  parseGatewayUrl,
  redactSecrets,
  summarizeConnection,
  type ConnectionProbe,
  type ConnectionUpdateRequest,
  type ProbeCheck,
  type ProbeCheckId,
} from "@/lib/api/connection";
import { getStoredConnectionFields, type ConnectionSession } from "@/lib/session";

const PROBE_TIMEOUT_MS = 8_000;

const CONNECT_ERROR_HINT: Record<string, string> = {
  ECONNREFUSED:
    "Connection refused — nothing is listening on that host and port.",
  ENOTFOUND: "Host not found — check the hostname.",
  EAI_AGAIN: "DNS lookup failed — check the hostname and your network.",
  ECONNRESET: "Connection reset by the Gateway.",
  EHOSTUNREACH: "Host unreachable from this machine.",
  ETIMEDOUT: "Connection timed out.",
  CERT_HAS_EXPIRED: "The Gateway's TLS certificate has expired.",
  DEPTH_ZERO_SELF_SIGNED_CERT:
    "The Gateway uses a self-signed TLS certificate.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    "The Gateway's TLS certificate could not be verified.",
};

function findErrorCode(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== "object" || depth > 3) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string") {
    return code;
  }
  const nested = (error as { errors?: unknown }).errors;
  if (Array.isArray(nested)) {
    for (const entry of nested) {
      const found = findErrorCode(entry, depth + 1);
      if (found) {
        return found;
      }
    }
  }
  return findErrorCode((error as { cause?: unknown }).cause, depth + 1);
}

function describeFetchError(error: unknown): string {
  const code = findErrorCode(error);
  if (code) {
    return CONNECT_ERROR_HINT[code] ?? `Request failed (${code}).`;
  }
  if (error instanceof Error && error.message !== "fetch failed") {
    return error.message;
  }
  return "Could not reach the Gateway — check the URL, port, and that the service is running.";
}

async function runCheck(
  id: ProbeCheckId,
  label: string,
  gatewayUrl: string,
  path: string,
  headers: Record<string, string>,
  secrets: Array<string | undefined>,
): Promise<ProbeCheck> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`${gatewayUrl}${path}`, {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    if (response.ok) {
      return {
        id,
        label,
        path,
        outcome: "ok",
        httpStatus: response.status,
        durationMs,
        detail: `HTTP ${response.status}`,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        id,
        label,
        path,
        outcome: "unauthorized",
        httpStatus: response.status,
        durationMs,
        detail:
          response.status === 401
            ? "Rejected (401) — credentials were not accepted."
            : "Forbidden (403) — the supplied token lacks permission.",
      };
    }

    return {
      id,
      label,
      path,
      outcome: "failed",
      httpStatus: response.status,
      durationMs,
      detail: `HTTP ${response.status} ${response.statusText}`.trim(),
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const aborted = error instanceof Error && error.name === "AbortError";
    const detail = aborted
      ? `No response within ${PROBE_TIMEOUT_MS / 1000}s.`
      : describeFetchError(error);

    return {
      id,
      label,
      path,
      outcome: "failed",
      durationMs,
      detail: redactSecrets(detail, secrets),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeConnection(
  credentials: ConnectionSession,
): Promise<ConnectionProbe> {
  const secrets = [credentials.apiKey, credentials.adminToken];
  const apiHeaders: Record<string, string> = {
    "X-API-Key": credentials.apiKey,
    Accept: "application/json",
  };
  const adminHeaders: Record<string, string> = credentials.adminToken
    ? { ...apiHeaders, "X-Admin-Token": credentials.adminToken }
    : apiHeaders;

  const nodesCheck: Promise<ProbeCheck> = credentials.adminToken
    ? runCheck(
        "nodes",
        "Nodes API",
        credentials.gatewayUrl,
        "/nodes",
        adminHeaders,
        secrets,
      )
    : Promise.resolve({
        id: "nodes",
        label: "Nodes API",
        path: "/nodes",
        outcome: "skipped",
        detail:
          "Unavailable due to permissions — add an admin token to view nodes.",
      });

  const checks = await Promise.all([
    runCheck(
      "health",
      "Gateway health",
      credentials.gatewayUrl,
      "/health",
      apiHeaders,
      secrets,
    ),
    runCheck(
      "sandboxes",
      "Sandboxes API",
      credentials.gatewayUrl,
      "/v2/sandboxes?limit=1",
      apiHeaders,
      secrets,
    ),
    nodesCheck,
  ]);

  const status = deriveConnectionStatus(checks);
  return {
    status,
    summary: summarizeConnection(status, checks),
    checks,
    checkedAt: new Date().toISOString(),
  };
}

export type ResolvedConnectionInput =
  | { ok: true; credentials: ConnectionSession; force: boolean }
  | { ok: false; error: string };

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function resolveConnectionInput(
  request: Request,
): Promise<ResolvedConnectionInput> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body !== null && typeof body !== "object") {
    return { ok: false, error: "Expected a JSON object body." };
  }

  const input = (body ?? {}) as ConnectionUpdateRequest;
  const stored = await getStoredConnectionFields();

  const gatewayUrlInput = optionalString(input.gatewayUrl) ?? stored.gatewayUrl;
  if (!gatewayUrlInput) {
    return { ok: false, error: "Gateway URL is required." };
  }
  const parsedUrl = parseGatewayUrl(gatewayUrlInput);
  if (!parsedUrl.ok) {
    return { ok: false, error: parsedUrl.error };
  }

  const apiKey = optionalString(input.apiKey) ?? stored.apiKey;
  if (!apiKey) {
    return { ok: false, error: "API key is required." };
  }

  const adminToken =
    input.clearAdminToken === true
      ? undefined
      : (optionalString(input.adminToken) ?? stored.adminToken);

  return {
    ok: true,
    credentials: { gatewayUrl: parsedUrl.url, apiKey, adminToken },
    force: input.force === true,
  };
}
