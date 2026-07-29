import { GaugeIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LoadResult } from "@/lib/api/dashboard";
import { aggregateCapacity, type ClusterNode } from "@/lib/api/nodes";
import { formatBytes, formatCount } from "@/components/dashboard/format";
import {
  EmptyState,
  PanelNotice,
  UsageBar,
} from "@/components/dashboard/primitives";

/** Host utilisation and sandbox reservations summed across every node. */
export function CapacityPanel({ nodes }: { nodes: LoadResult<ClusterNode[]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GaugeIcon className="size-4 text-muted-foreground" />
          Cluster capacity
        </CardTitle>
        <CardDescription>
          Host usage across all nodes. The marker shows CPU/memory reserved by
          running sandboxes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!nodes.ok ? (
          <PanelNotice result={nodes} resourceLabel="cluster capacity" />
        ) : nodes.data.length === 0 ? (
          <EmptyState>No nodes are reporting to this Gateway.</EmptyState>
        ) : (
          <CapacityBars nodes={nodes.data} />
        )}
      </CardContent>
    </Card>
  );
}

function CapacityBars({ nodes }: { nodes: ClusterNode[] }) {
  const capacity = aggregateCapacity(nodes);
  const cpuUsed =
    capacity.cpuPercent === null
      ? undefined
      : (capacity.cpuPercent / 100) * capacity.cpuCount;

  return (
    <>
      <UsageBar
        label="CPU"
        used={cpuUsed}
        total={capacity.cpuCount}
        usedLabel={
          cpuUsed === undefined ? "—" : `${cpuUsed.toFixed(1)} cores busy`
        }
        totalLabel={`${formatCount(capacity.cpuCount)} cores`}
        secondary={capacity.cpuAllocated}
        secondaryLabel={`${formatCount(capacity.cpuAllocated)} allocated · ${formatCount(
          capacity.cpuAllocatedPaused,
        )} paused`}
      />
      <UsageBar
        label="Memory"
        used={capacity.memoryUsedBytes}
        total={capacity.memoryTotalBytes}
        usedLabel={formatBytes(capacity.memoryUsedBytes)}
        totalLabel={formatBytes(capacity.memoryTotalBytes)}
        secondary={capacity.memoryAllocatedBytes}
        secondaryLabel={`${formatBytes(
          capacity.memoryAllocatedBytes,
        )} allocated · ${formatBytes(
          capacity.memoryAllocatedPausedBytes,
        )} paused`}
      />
      <UsageBar
        label="Disk"
        used={capacity.diskUsedBytes}
        total={capacity.diskTotalBytes}
        usedLabel={formatBytes(capacity.diskUsedBytes)}
        totalLabel={formatBytes(capacity.diskTotalBytes)}
      />
    </>
  );
}
