import { cookies } from "next/headers";
import {
  EMPTY_SESSION_SUMMARY,
  maskSecret,
  type ConnectionSessionSummary,
} from "@/lib/api/connection";

export const SESSION_COOKIE = {
  gatewayUrl: "aenv_gateway_url",
  apiKey: "aenv_api_key",
  adminToken: "aenv_admin_token",
} as const;

export type ConnectionSession = {
  gatewayUrl: string;
  apiKey: string;
  adminToken?: string;
};

function normalizeGatewayUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export async function getConnectionSession(): Promise<ConnectionSession | null> {
  const jar = await cookies();
  const gatewayUrl = jar.get(SESSION_COOKIE.gatewayUrl)?.value;
  const apiKey = jar.get(SESSION_COOKIE.apiKey)?.value;
  const adminToken = jar.get(SESSION_COOKIE.adminToken)?.value;

  if (!gatewayUrl || !apiKey) {
    return null;
  }

  return {
    gatewayUrl: normalizeGatewayUrl(gatewayUrl),
    apiKey,
    adminToken: adminToken || undefined,
  };
}

/**
 * Session cookies: no `maxAge`/`expires`, so the browser drops them when it
 * closes. Credentials must not outlive the browser session (issue #6).
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/**
 * Cookie values as stored, without requiring a complete session. Used when
 * merging a partial settings update over what is already saved.
 */
export async function getStoredConnectionFields(): Promise<
  Partial<ConnectionSession>
> {
  const jar = await cookies();
  const gatewayUrl = jar.get(SESSION_COOKIE.gatewayUrl)?.value;
  const apiKey = jar.get(SESSION_COOKIE.apiKey)?.value;
  const adminToken = jar.get(SESSION_COOKIE.adminToken)?.value;

  return {
    gatewayUrl: gatewayUrl ? normalizeGatewayUrl(gatewayUrl) : undefined,
    apiKey: apiKey || undefined,
    adminToken: adminToken || undefined,
  };
}

export async function setConnectionSession(
  session: ConnectionSession,
): Promise<void> {
  const jar = await cookies();
  const options = sessionCookieOptions();

  jar.set(
    SESSION_COOKIE.gatewayUrl,
    normalizeGatewayUrl(session.gatewayUrl),
    options,
  );
  jar.set(SESSION_COOKIE.apiKey, session.apiKey, options);
  if (session.adminToken) {
    jar.set(SESSION_COOKIE.adminToken, session.adminToken, options);
  } else {
    jar.delete(SESSION_COOKIE.adminToken);
  }
}

export async function clearConnectionSession(): Promise<void> {
  const jar = await cookies();
  for (const name of Object.values(SESSION_COOKIE)) {
    jar.delete(name);
  }
}

/** Client-safe projection of a session: URL in the clear, secrets masked. */
export function summarizeConnectionSession(
  session: ConnectionSession,
): ConnectionSessionSummary {
  return {
    configured: true,
    gatewayUrl: normalizeGatewayUrl(session.gatewayUrl),
    apiKeyMasked: maskSecret(session.apiKey),
    adminTokenMasked: session.adminToken
      ? maskSecret(session.adminToken)
      : null,
    hasAdminToken: Boolean(session.adminToken),
  };
}

export async function getConnectionSessionSummary(): Promise<ConnectionSessionSummary> {
  const session = await getConnectionSession();
  return session ? summarizeConnectionSession(session) : EMPTY_SESSION_SUMMARY;
}
