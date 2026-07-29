import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NodeStatus } from "@/lib/api/types";
import type { PressureLevel } from "@/lib/api/nodes";

export type DisplayNodeStatus = NodeStatus | "unknown";

/**
 * Display order for status filters. Kept here rather than imported from
 * `@/lib/api/nodes` so client components never pull the server-only Gateway
 * client (and therefore `next/headers`) into their bundle.
 */
export const DISPLAY_NODE_STATUSES = [
  "ready",
  "draining",
  "connecting",
  "unhealthy",
] as const satisfies readonly NodeStatus[];

const STATUS_STYLE: Record<
  DisplayNodeStatus,
  { label: string; dot: string; className: string }
> = {
  ready: {
    label: "Ready",
    dot: "bg-emerald-500",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  connecting: {
    label: "Connecting",
    dot: "bg-sky-500",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  },
  draining: {
    label: "Draining",
    dot: "bg-amber-500",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  unhealthy: {
    label: "Unhealthy",
    dot: "bg-red-500",
    className: "border-red-500/30 bg-red-500/10 text-red-500",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-muted-foreground",
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

export function nodeStatusLabel(status: DisplayNodeStatus): string {
  return STATUS_STYLE[status].label;
}

export function NodeStatusBadge({
  status,
  className,
}: {
  status: DisplayNodeStatus;
  className?: string;
}) {
  const style = STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </Badge>
  );
}

const PRESSURE_STYLE: Record<PressureLevel, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  critical: "border-red-500/30 bg-red-500/10 text-red-500",
};

const PRESSURE_LABEL: Record<PressureLevel, string> = {
  ok: "Healthy",
  warn: "Degraded",
  critical: "At risk",
};

export function PressureBadge({
  level,
  className,
}: {
  level: PressureLevel;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(PRESSURE_STYLE[level], className)}>
      {PRESSURE_LABEL[level]}
    </Badge>
  );
}
