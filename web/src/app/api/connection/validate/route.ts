/**
 * Dry-run connectivity check. Probes the Gateway with the submitted (or
 * stored) credentials and reports per-endpoint results without writing cookies.
 */

import { NextResponse } from "next/server";

import type { ConnectionApiResponse } from "@/lib/api/connection";
import {
  probeConnection,
  resolveConnectionInput,
} from "@/lib/api/connection-server";
import { getConnectionSessionSummary } from "@/lib/session";

export async function POST(request: Request) {
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
}
