/**
 * Connection session endpoints.
 *
 *   GET    — current session status (masked secrets, no network calls)
 *   POST   — validate then save credentials into httpOnly cookies
 *   DELETE — clear the session (logout)
 */

import { NextResponse } from "next/server";

import {
  EMPTY_SESSION_SUMMARY,
  type ConnectionApiResponse,
} from "@/lib/api/connection";
import {
  probeConnection,
  resolveConnectionInput,
} from "@/lib/api/connection-server";
import {
  clearConnectionSession,
  getConnectionSessionSummary,
  setConnectionSession,
  summarizeConnectionSession,
} from "@/lib/session";

export async function GET() {
  const payload: ConnectionApiResponse = {
    session: await getConnectionSessionSummary(),
    probe: null,
  };
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const resolved = await resolveConnectionInput(request);
  if (!resolved.ok) {
    const payload: ConnectionApiResponse = {
      session: await getConnectionSessionSummary(),
      probe: null,
      error: resolved.error,
    };
    return NextResponse.json(payload, { status: 400 });
  }

  const probe = await probeConnection(resolved.credentials);

  // A missing admin token only degrades to `partial`, so saving stays allowed.
  // A hard `disconnected` result needs an explicit override from the operator.
  if (probe.status === "disconnected" && !resolved.force) {
    const payload: ConnectionApiResponse = {
      session: await getConnectionSessionSummary(),
      probe,
      error: probe.summary,
    };
    return NextResponse.json(payload, { status: 400 });
  }

  await setConnectionSession(resolved.credentials);

  const payload: ConnectionApiResponse = {
    session: summarizeConnectionSession(resolved.credentials),
    probe,
  };
  return NextResponse.json(payload);
}

export async function DELETE() {
  await clearConnectionSession();

  const payload: ConnectionApiResponse = {
    session: EMPTY_SESSION_SUMMARY,
    probe: null,
  };
  return NextResponse.json(payload);
}
