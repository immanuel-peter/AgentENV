import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EXPIRING_SOON_MS, formatRelative, millisUntil } from "@/components/sandboxes/format";
import type { SandboxLifecycleState } from "@/lib/api/sandboxes";

export function SandboxStateBadge({
  state,
  className,
}: {
  state: SandboxLifecycleState | string;
  className?: string;
}) {
  const normalized = state?.toLowerCase();

  // Tinted fills matching BuildStatusBadge, so lifecycle and build state read as
  // one status language. A solid `default` badge here made every running row
  // shout louder than the data in it.
  const tone =
    normalized === "running"
      ? {
          badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
          dot: "bg-emerald-400",
        }
      : normalized === "paused"
        ? {
            badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
            dot: "bg-amber-400",
          }
        : {
            badge: "border-border bg-muted/40 text-muted-foreground",
            dot: "bg-muted-foreground",
          };

  return (
    <Badge
      variant="outline"
      className={cn("capitalize", tone.badge, className)}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {state || "unknown"}
    </Badge>
  );
}

/**
 * Expiry as a countdown. Renders a stable placeholder until `now` is available
 * so server and client markup agree on the first paint.
 */
export function ExpiryBadge({ endAt, now }: { endAt?: string; now: number | null }) {
  if (!endAt) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (now === null) {
    return <span className="text-muted-foreground tabular-nums">…</span>;
  }

  const remaining = millisUntil(endAt, now);
  if (remaining === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (remaining <= 0) {
    return <Badge variant="destructive">expired</Badge>;
  }

  return (
    <span
      className={cn(
        "tabular-nums",
        remaining <= EXPIRING_SOON_MS ? "text-amber-400" : "text-muted-foreground",
      )}
    >
      {formatRelative(endAt, now)}
    </span>
  );
}

export function SandboxSourceLink({
  templateID,
  alias,
}: {
  templateID?: string;
  alias?: string;
}) {
  if (!templateID) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col">
      <Link
        href={`/templates?highlight=${encodeURIComponent(templateID)}`}
        className="font-mono text-xs hover:underline"
      >
        {templateID}
      </Link>
      {alias ? (
        <span className="text-xs text-muted-foreground">{alias}</span>
      ) : null}
    </div>
  );
}

export function MetadataChips({
  metadata,
  limit = 2,
}: {
  metadata?: Record<string, string>;
  limit?: number;
}) {
  const entries = Object.entries(metadata ?? {});
  if (entries.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const shown = entries.slice(0, limit);
  const hidden = entries.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(([key, value]) => (
        <Badge key={key} variant="outline" className="max-w-44 font-mono text-[11px]">
          <span className="truncate">
            {key}={value}
          </span>
        </Badge>
      ))}
      {hidden > 0 ? (
        <span className="text-xs text-muted-foreground">+{hidden}</span>
      ) : null}
    </div>
  );
}
