/** Dry-run connectivity check. Probes without writing cookies. */

import { NextResponse } from "next/server";

import {
  EMPTY_SESSION_SUMMARY,
  type ConnectionApiResponse,
} from "@/lib/api/connection";
import {
  probeConnection,
  resolveConnectionInput,
} from "@/lib/api/connection-server";
import { getConnectionSessionSummary } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const resolved = await resolveConnectionInput(request);
    const session = await getConnectionSessionSummary();

    if (!resolved.ok) {
      const payload: ConnectionApiResponse = {
        session,
        probe: null,
        error: resolved.error,
      };
      return NextResponse.json(payload, { status: 400 });
    }

    const payload: ConnectionApiResponse = {
      session,
      probe: await probeConnection(resolved.credentials),
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("connection validate failed", error);
    const payload: ConnectionApiResponse = {
      session: EMPTY_SESSION_SUMMARY,
      probe: null,
      error: "Could not validate the connection.",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}
