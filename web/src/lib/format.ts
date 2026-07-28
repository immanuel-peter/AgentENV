/** Formatting helpers shared by the console tables and detail views. */

export function formatMiB(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  if (value >= 1024) {
    const gib = value / 1024;
    return `${Number.isInteger(gib) ? gib : gib.toFixed(1)} GiB`;
  }
  return `${value} MiB`;
}

export function formatCpu(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value} vCPU`;
}

export function formatNumber(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("en-US");
}

// Timestamps are rendered by `@/components/local-time`, which formats in the
// viewer's locale after hydration and keeps the original ISO value reachable
// through `title`/`dateTime`. Do not reintroduce a string formatter here:
// locale formatting during SSR would not match the client pass.
