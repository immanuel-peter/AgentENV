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
