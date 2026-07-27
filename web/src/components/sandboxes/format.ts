/** Presentation helpers shared by the sandbox list, detail, and create views. */

/** Sandboxes within this window of their expiration are surfaced as at-risk. */
export const EXPIRING_SOON_MS = 5 * 60 * 1000;

export function formatTimestamp(iso: string | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatRelative(iso: string | undefined, now: number): string {
  if (!iso) {
    return "—";
  }
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return iso;
  }
  const delta = time - now;
  return delta >= 0
    ? `in ${formatDuration(delta)}`
    : `${formatDuration(delta)} ago`;
}

export function millisUntil(iso: string | undefined, now: number): number | null {
  if (!iso) {
    return null;
  }
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return time - now;
}

export function formatMemoryMB(memoryMB: number | undefined): string {
  if (memoryMB === undefined || memoryMB === null) {
    return "—";
  }
  if (memoryMB >= 1024) {
    const gib = memoryMB / 1024;
    return `${Number.isInteger(gib) ? gib : gib.toFixed(1)} GiB`;
  }
  return `${memoryMB} MiB`;
}

export function formatCpu(cpuCount: number | undefined): string {
  if (cpuCount === undefined || cpuCount === null) {
    return "—";
  }
  return `${cpuCount} vCPU`;
}

/** Truncates long identifiers for table cells while keeping both ends legible. */
export function shortId(id: string, head = 10, tail = 4): string {
  if (id.length <= head + tail + 1) {
    return id;
  }
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export type ParsedPairs =
  | { ok: true; value: Record<string, string> }
  | { ok: false; error: string };

/** Parses `KEY=value` lines used by the env var and metadata editors. */
export function parseKeyValueLines(raw: string): ParsedPairs {
  const value: Record<string, string> = {};
  const lines = raw.split("\n");

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      return {
        ok: false,
        error: `Line ${index + 1} must use KEY=value format.`,
      };
    }
    const key = trimmed.slice(0, separator).trim();
    if (key === "") {
      return { ok: false, error: `Line ${index + 1} is missing a key.` };
    }
    value[key] = trimmed.slice(separator + 1).trim();
  }

  return { ok: true, value };
}

export function parseCommaSeparated(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

export type ParsedJsonObject =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export function parseJsonObject(raw: string): ParsedJsonObject {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Must be a JSON object." };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

export function isEmptyObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}
