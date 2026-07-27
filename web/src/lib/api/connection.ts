/**
 * Isomorphic connection-session types and helpers.
 *
 * Nothing here touches cookies or the network, so it is safe to import from
 * both client components and server code. Raw secrets never leave the server:
 * the client only ever receives the masked forms produced here.
 */

export type ConnectionStatus = "connected" | "partial" | "disconnected";

export type ProbeOutcome = "ok" | "unauthorized" | "failed" | "skipped";

export type ProbeCheckId = "health" | "sandboxes" | "nodes";

export type ProbeCheck = {
  id: ProbeCheckId;
  label: string;
  /** Request path relative to the Gateway base URL, for display. */
  path: string;
  outcome: ProbeOutcome;
  httpStatus?: number;
  durationMs?: number;
  /** Human-readable result. Secrets are redacted before this is populated. */
  detail: string;
};

export type ConnectionProbe = {
  status: ConnectionStatus;
  summary: string;
  checks: ProbeCheck[];
  checkedAt: string;
};

/** Client-safe view of the stored session. Secrets are masked. */
export type ConnectionSessionSummary = {
  configured: boolean;
  gatewayUrl: string | null;
  apiKeyMasked: string | null;
  adminTokenMasked: string | null;
  hasAdminToken: boolean;
};

export const EMPTY_SESSION_SUMMARY: ConnectionSessionSummary = {
  configured: false,
  gatewayUrl: null,
  apiKeyMasked: null,
  adminTokenMasked: null,
  hasAdminToken: false,
};

/**
 * Request body accepted by the /api/connection route handlers.
 *
 * Omitted or blank secret fields mean "keep whatever is already stored", so
 * the UI never has to round-trip a secret it cannot read.
 */
export type ConnectionUpdateRequest = {
  gatewayUrl?: string;
  apiKey?: string;
  adminToken?: string;
  /** Explicitly drop the stored admin token instead of keeping it. */
  clearAdminToken?: boolean;
  /** Save even when validation reports `disconnected`. */
  force?: boolean;
};

export type ConnectionApiResponse = {
  session: ConnectionSessionSummary;
  probe: ConnectionProbe | null;
  error?: string;
};

/** Renders a secret as bullets plus its last 4 characters. */
export function maskSecret(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 4) {
    return "•".repeat(trimmed.length);
  }
  return `${"•".repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

/** Replaces any occurrence of the given secrets with a placeholder. */
export function redactSecrets(
  text: string,
  secrets: Array<string | undefined>,
): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) {
      continue;
    }
    out = out.split(secret).join("[redacted]");
  }
  return out;
}

export type GatewayUrlParse =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Validates and normalizes a Gateway base URL (scheme + host + base path). */
export function parseGatewayUrl(raw: string): GatewayUrlParse {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Gateway URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "Enter a full URL, for example http://127.0.0.1:8080",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Gateway URL must use http:// or https://" };
  }
  if (!parsed.hostname) {
    return { ok: false, error: "Gateway URL is missing a hostname." };
  }

  const basePath = parsed.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${parsed.protocol}//${parsed.host}${basePath}` };
}

function findCheck(
  checks: ProbeCheck[],
  id: ProbeCheckId,
): ProbeCheck | undefined {
  return checks.find((check) => check.id === id);
}

/**
 * Reduces the individual probes to a single status.
 *
 * `/nodes` needs an admin token, so its absence downgrades to `partial`
 * rather than failing the connection.
 */
export function deriveConnectionStatus(checks: ProbeCheck[]): ConnectionStatus {
  const health = findCheck(checks, "health");
  const sandboxes = findCheck(checks, "sandboxes");
  const nodes = findCheck(checks, "nodes");

  if (!sandboxes) {
    return "disconnected";
  }

  switch (sandboxes.outcome) {
    case "ok":
      break;
    case "unauthorized":
      return "disconnected";
    case "failed":
    case "skipped":
      return health?.outcome === "ok" ? "partial" : "disconnected";
    default: {
      const exhaustive: never = sandboxes.outcome;
      return exhaustive;
    }
  }

  if (health?.outcome !== "ok") {
    return "partial";
  }
  return nodes?.outcome === "ok" ? "connected" : "partial";
}

export function summarizeConnection(
  status: ConnectionStatus,
  checks: ProbeCheck[],
): string {
  switch (status) {
    case "connected":
      return "Gateway reachable. API key and admin token accepted.";
    case "partial": {
      const nodes = findCheck(checks, "nodes");
      if (nodes && nodes.outcome === "skipped") {
        return "Gateway reachable. Node views are unavailable without an admin token.";
      }
      if (nodes && nodes.outcome !== "ok") {
        return "Gateway reachable. Node views are unavailable with the current admin token.";
      }
      return "Gateway partially reachable — review the individual checks.";
    }
    case "disconnected":
      return "Gateway is unreachable or the API key was rejected.";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  partial: "Partial",
  disconnected: "Disconnected",
};
