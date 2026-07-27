import type { ReactNode } from "react";
import Link from "next/link";
import { LockIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPercent, percentOf } from "@/components/dashboard/format";
import type { LoadResult } from "@/lib/api/dashboard";

export type Tone = "neutral" | "positive" | "warning" | "critical";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-destructive",
};

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-foreground/60",
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-destructive",
};

export function toneForPercent(percent: number | null): Tone {
  if (percent === null) {
    return "neutral";
  }
  if (percent >= 90) {
    return "critical";
  }
  if (percent >= 75) {
    return "warning";
  }
  return "positive";
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Bottom-aligned so the readouts share a baseline across the row even
        // when a longer label wraps to two lines.
        "flex h-full flex-col justify-between rounded-lg bg-muted/30 px-3 py-2.5 ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="label-micro text-muted-foreground">{label}</div>
      <div
        className={cn(
          "numeric-readout mt-2 text-[1.375rem] leading-none font-semibold",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

/** Horizontal usage meter with an optional secondary (allocation) marker. */
export function UsageBar({
  label,
  used,
  total,
  usedLabel,
  totalLabel,
  secondary,
  secondaryLabel,
  className,
}: {
  label: string;
  used?: number;
  total?: number;
  usedLabel: string;
  totalLabel: string;
  secondary?: number;
  secondaryLabel?: string;
  className?: string;
}) {
  const percent = percentOf(used, total);
  const secondaryPercent = percentOf(secondary, total);
  const tone = toneForPercent(percent);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className={TONE_TEXT[tone]}>{usedLabel}</span>
          <span className="text-muted-foreground"> / {totalLabel}</span>
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
          style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
        />
        {secondaryPercent !== null ? (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground/70"
            style={{ left: `${Math.min(secondaryPercent, 100)}%` }}
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{percent === null ? "no data" : formatPercent(percent)}</span>
        {secondaryLabel ? <span>{secondaryLabel}</span> : null}
      </div>
    </div>
  );
}

export function DefinitionRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm break-all",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

/** Panel-level notice for a failed or unauthorized data source. */
export function PanelNotice({
  result,
  resourceLabel,
}: {
  result: { ok: false; status?: number; message: string };
  resourceLabel: string;
}) {
  const needsAdminToken = result.status === 403 || result.status === 401;

  return (
    <Alert variant={needsAdminToken ? "default" : "destructive"}>
      {needsAdminToken ? <LockIcon /> : <TriangleAlertIcon />}
      <AlertTitle>
        {needsAdminToken
          ? `Admin token required for ${resourceLabel}`
          : `Could not load ${resourceLabel}`}
      </AlertTitle>
      <AlertDescription>
        <span>{result.message}</span>
        {needsAdminToken ? (
          <Button
            size="xs"
            variant="outline"
            className="mt-2 w-fit"
            nativeButton={false}
            render={<Link href="/settings" />}
          >
            Add admin token
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function unwrap<T>(result: LoadResult<T>): T | null {
  return result.ok ? result.data : null;
}
