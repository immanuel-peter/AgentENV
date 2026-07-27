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

/** Stable UTC rendering so server and client markup always agree. */
export function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function formatTime(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(11, 23);
}
