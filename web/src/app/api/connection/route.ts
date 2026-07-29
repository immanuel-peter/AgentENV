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

async function errorResponse(
  status: number,
  message: string,
): Promise<NextResponse<ConnectionApiResponse>> {
  const payload: ConnectionApiResponse = {
    session: await getConnectionSessionSummary(),
    probe: null,
    error: message,
  };
  return NextResponse.json(payload, { status });
}

export async function GET() {
  try {
    const payload: ConnectionApiResponse = {
      session: await getConnectionSessionSummary(),
      probe: null,
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("connection GET failed", error);
    return errorResponse(500, "Could not read the connection session.");
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    console.error("connection POST failed", error);
    return errorResponse(500, "Could not save the connection session.");
  }
}

export async function DELETE() {
  try {
    await clearConnectionSession();

    const payload: ConnectionApiResponse = {
      session: EMPTY_SESSION_SUMMARY,
      probe: null,
    };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("connection DELETE failed", error);
    return errorResponse(500, "Could not clear the connection session.");
  }
}
