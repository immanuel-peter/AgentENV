import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  nodePressure,
  nodeStatus,
  type ClusterNode,
  type ClusterNodeMetrics,
} from "@/lib/api/nodes";
import {
  formatBytes,
  formatCount,
  formatPercent,
  percentOf,
  shortCommit,
  truncateId,
} from "@/components/dashboard/format";
import { toneForPercent } from "@/components/dashboard/primitives";
import { NodeStatusBadge } from "@/components/nodes/node-status-badge";

const TONE_TEXT = {
  neutral: "text-foreground",
  positive: "text-foreground",
  warning: "text-amber-400",
  critical: "text-destructive",
} as const;

function nodeHref(node: ClusterNode): string {
  const path = `/nodes/${encodeURIComponent(node.id)}`;
  return node.clusterID
    ? `${path}?cluster=${encodeURIComponent(node.clusterID)}`
    : path;
}

function MeterCell({
  percent,
  primary,
  secondary,
}: {
  percent: number | null;
  primary: string;
  secondary: string;
}) {
  const tone = toneForPercent(percent);

  return (
    <div className="min-w-28 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={cn("tabular-nums", TONE_TEXT[tone])}>{primary}</span>
        <span className="text-muted-foreground tabular-nums">
          {percent === null ? "—" : formatPercent(percent)}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "critical"
              ? "bg-destructive"
              : tone === "warning"
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
          style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground">{secondary}</div>
    </div>
  );
}

function cpuCell(metrics?: ClusterNodeMetrics) {
  const cpuCount = metrics?.cpuCount ?? 0;
  const percent =
    typeof metrics?.cpuPercent === "number" ? metrics.cpuPercent : null;
  return (
    <MeterCell
      percent={percent}
      primary={`${formatCount(cpuCount)} cores`}
      secondary={`${formatCount(metrics?.allocatedCPU ?? 0)} allocated · ${formatCount(
        metrics?.pausedAllocatedCPU ?? 0,
      )} paused`}
    />
  );
}

function memoryCell(metrics?: ClusterNodeMetrics) {
  const percent = percentOf(
    metrics?.memoryUsedBytes,
    metrics?.memoryTotalBytes,
  );
  return (
    <MeterCell
      percent={percent}
      primary={`${formatBytes(metrics?.memoryUsedBytes)} / ${formatBytes(
        metrics?.memoryTotalBytes,
      )}`}
      secondary={`${formatBytes(
        metrics?.allocatedMemoryBytes,
      )} allocated · ${formatBytes(metrics?.pausedAllocatedMemoryBytes)} paused`}
    />
  );
}

export function NodesTable({ nodes }: { nodes: ClusterNode[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Node</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Sandboxes</TableHead>
          <TableHead>CPU</TableHead>
          <TableHead>Memory</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.map((node) => {
          const status = nodeStatus(node);
          const pressure = nodePressure(node);
          const unhealthy = pressure.level === "critical";

          return (
            <TableRow
              key={node.id}
              className={cn(unhealthy && "bg-destructive/5")}
            >
              <TableCell className="align-top">
                <Link
                  href={nodeHref(node)}
                  className="font-mono text-xs underline-offset-4 hover:underline"
                  title={node.id}
                >
                  {truncateId(node.id, 20)}
                </Link>
                <div
                  className="text-[11px] text-muted-foreground"
                  title={node.clusterID}
                >
                  cluster {truncateId(node.clusterID, 12)}
                </div>
              </TableCell>
              <TableCell className="align-top">
                <NodeStatusBadge status={status} />
                {pressure.level !== "ok" && pressure.reasons.length > 0 ? (
                  <div
                    className={cn(
                      "mt-1 max-w-40 text-[11px] whitespace-normal",
                      unhealthy ? "text-destructive" : "text-amber-400",
                    )}
                  >
                    {pressure.reasons.join(" · ")}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="align-top text-xs">
                <div>{node.version || "—"}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {shortCommit(node.commit)}
                </div>
              </TableCell>
              <TableCell className="align-top text-xs tabular-nums">
                <div>{formatCount(node.sandboxCount ?? 0)} running</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatCount(node.sandboxStartingCount ?? 0)} starting ·{" "}
                  {formatCount(node.sandboxPausedCount ?? 0)} paused
                </div>
              </TableCell>
              <TableCell className="align-top">
                {cpuCell(node.metrics)}
              </TableCell>
              <TableCell className="align-top">
                {memoryCell(node.metrics)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
