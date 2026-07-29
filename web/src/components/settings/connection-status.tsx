"use client";

import {
  CircleCheckIcon,
  CircleMinusIcon,
  CircleXIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATUS_LABEL,
  type ConnectionStatus,
  type ProbeCheck,
  type ProbeOutcome,
} from "@/lib/api/connection";

const STATUS_BADGE_CLASS: Record<ConnectionStatus, string> = {
  connected: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  partial: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  disconnected: "border-destructive/40 bg-destructive/10 text-destructive",
};

const STATUS_DOT_CLASS: Record<ConnectionStatus, string> = {
  connected: "bg-emerald-400",
  partial: "bg-amber-400",
  disconnected: "bg-destructive",
};

export function ConnectionStatusBadge({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", STATUS_BADGE_CLASS[status], className)}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[status])}
      />
      {CONNECTION_STATUS_LABEL[status]}
    </Badge>
  );
}

function OutcomeIcon({ outcome }: { outcome: ProbeOutcome }) {
  switch (outcome) {
    case "ok":
      return <CircleCheckIcon className="size-4 shrink-0 text-emerald-400" />;
    case "unauthorized":
      return <TriangleAlertIcon className="size-4 shrink-0 text-amber-400" />;
    case "failed":
      return <CircleXIcon className="size-4 shrink-0 text-destructive" />;
    case "skipped":
      return (
        <CircleMinusIcon className="size-4 shrink-0 text-muted-foreground" />
      );
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

export function ProbeCheckRow({ check }: { check: ProbeCheck }) {
  return (
    <li className="flex items-start gap-2.5 border-t border-border/60 py-2 first:border-t-0 first:pt-0">
      <span className="pt-0.5">
        <OutcomeIcon outcome={check.outcome} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{check.label}</span>
          <code className="font-mono text-xs text-muted-foreground">
            GET {check.path}
          </code>
          {check.durationMs !== undefined ? (
            <span className="text-xs text-muted-foreground/70 tabular-nums">
              {check.durationMs} ms
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{check.detail}</p>
      </div>
    </li>
  );
}
