import Link from "next/link";
import { ServerIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LoadResult } from "@/lib/api/dashboard";
import {
  aggregateCapacity,
  countNodesByStatus,
  NODE_STATUSES,
  type ClusterNode,
} from "@/lib/api/nodes";
import { formatCount, formatPercent } from "@/components/dashboard/format";
import { PanelNotice, StatTile } from "@/components/dashboard/primitives";
import { NodeStatusBadge } from "@/components/nodes/node-status-badge";

export function ClusterPanel({ nodes }: { nodes: LoadResult<ClusterNode[]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ServerIcon className="size-4 text-muted-foreground" />
          Nodes
        </CardTitle>
        <CardDescription>Cluster inventory by reported status.</CardDescription>
        <CardAction>
          <Button
            size="xs"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/nodes" />}
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!nodes.ok ? (
          <PanelNotice result={nodes} resourceLabel="node inventory" />
        ) : (
          <NodeCounts nodes={nodes.data} />
        )}
      </CardContent>
    </Card>
  );
}

function NodeCounts({ nodes }: { nodes: ClusterNode[] }) {
  const counts = countNodesByStatus(nodes);
  const capacity = aggregateCapacity(nodes);
  const createTotal = capacity.createSuccesses + capacity.createFails;
  const failureRate =
    createTotal > 0 ? (capacity.createFails / createTotal) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">
          {formatCount(counts.total)}
        </span>
        <span className="text-sm text-muted-foreground">
          node{counts.total === 1 ? "" : "s"} observed
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {NODE_STATUSES.map((status) => (
          <div
            key={status}
            className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 ring-1 ring-foreground/5"
          >
            <NodeStatusBadge status={status} />
            <span className="text-sm font-medium tabular-nums">
              {formatCount(counts[status])}
            </span>
          </div>
        ))}
        {counts.unknown > 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 ring-1 ring-foreground/5">
            <NodeStatusBadge status="unknown" />
            <span className="text-sm font-medium tabular-nums">
              {formatCount(counts.unknown)}
            </span>
          </div>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <StatTile
          label="Create OK"
          value={formatCount(capacity.createSuccesses)}
          tone="positive"
        />
        <StatTile
          label="Create failed"
          value={formatCount(capacity.createFails)}
          tone={capacity.createFails > 0 ? "critical" : "neutral"}
        />
        <StatTile
          label="Failure rate"
          value={failureRate === null ? "—" : formatPercent(failureRate, 1)}
          hint={`${formatCount(createTotal)} attempts`}
          tone={
            failureRate !== null && failureRate >= 5 ? "warning" : "neutral"
          }
        />
      </div>
    </div>
  );
}
