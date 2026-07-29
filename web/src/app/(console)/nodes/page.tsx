import type { Metadata } from "next";
import { ServerIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, userFacingApiMessage } from "@/lib/api/errors";
import {
  aggregateCapacity,
  countNodesByStatus,
  listNodes,
  nodeStatus,
  type ClusterNode,
} from "@/lib/api/nodes";
import { getConnectionSession } from "@/lib/session";
import { formatBytes, formatCount } from "@/components/dashboard/format";
import { NotConnected } from "@/components/dashboard/not-connected";
import {
  EmptyState,
  PanelNotice,
  StatTile,
} from "@/components/dashboard/primitives";
import { RefreshControls } from "@/components/dashboard/refresh-controls";
import {
  NodeFilters,
  type NodeStatusFilter,
} from "@/components/nodes/node-filters";
import { NodesTable } from "@/components/nodes/nodes-table";
import { type DisplayNodeStatus } from "@/components/nodes/node-status-badge";

export const metadata: Metadata = {
  title: "Nodes · AgentENV",
};

export const dynamic = "force-dynamic";

const STATUS_FILTERS: readonly NodeStatusFilter[] = [
  "all",
  "ready",
  "draining",
  "connecting",
  "unhealthy",
  "unknown",
];

function parseStatus(raw?: string): NodeStatusFilter {
  const candidate = (raw ?? "all").toLowerCase();
  return STATUS_FILTERS.includes(candidate as NodeStatusFilter)
    ? (candidate as NodeStatusFilter)
    : "all";
}

function matchesQuery(node: ClusterNode, query: string): boolean {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  const haystack = [
    node.id,
    node.clusterID,
    node.serviceInstanceID,
    node.version,
    node.commit,
    node.machineInfo?.cpuModelName,
    node.machineInfo?.cpuArchitecture,
  ];
  return haystack.some((value) => value?.toLowerCase().includes(needle));
}

function matchesStatus(node: ClusterNode, status: NodeStatusFilter): boolean {
  if (status === "all") {
    return true;
  }
  const current: DisplayNodeStatus = nodeStatus(node);
  return current === status;
}

export default async function NodesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status: rawStatus } = await searchParams;
  const query = (q ?? "").trim();
  const status = parseStatus(rawStatus);
  const session = await getConnectionSession();
  const fetchedAt = new Date().toISOString();

  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeading />
        <NotConnected
          title="Not connected to a Gateway"
          description="Node inventory comes from the Gateway admin API. Configure the connection in Settings to continue."
        />
      </div>
    );
  }

  if (!session.adminToken) {
    return (
      <div className="space-y-4">
        <PageHeading />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerIcon className="size-4 text-muted-foreground" />
              Node inventory
            </CardTitle>
            <CardDescription>
              <code className="font-mono text-xs">GET /nodes</code> requires an
              admin token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PanelNotice
              result={{
                ok: false,
                status: 403,
                message:
                  "No admin token is stored for this Gateway. Sandbox, template, and snapshot views keep working without it.",
              }}
              resourceLabel="nodes"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  let nodes: ClusterNode[] = [];
  let error: { status?: number; message: string } | null = null;
  try {
    nodes = await listNodes();
  } catch (caught) {
    error = {
      status: caught instanceof ApiError ? caught.status : undefined,
      message: userFacingApiMessage(caught),
    };
  }

  const counts = countNodesByStatus(nodes);
  const capacity = aggregateCapacity(nodes);
  const visible = nodes.filter(
    (node) => matchesStatus(node, status) && matchesQuery(node, query),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading />
        <RefreshControls
          fetchedAt={fetchedAt}
          storageKey="aenv:nodes:auto-refresh"
        />
      </div>

      {error ? (
        <PanelNotice result={{ ok: false, ...error }} resourceLabel="nodes" />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Nodes"
              value={formatCount(counts.total)}
              hint={`${formatCount(counts.ready)} ready`}
            />
            <StatTile
              label="Unhealthy"
              value={formatCount(counts.unhealthy)}
              tone={counts.unhealthy > 0 ? "critical" : "positive"}
              hint={`${formatCount(counts.draining)} draining · ${formatCount(
                counts.connecting,
              )} connecting`}
            />
            <StatTile
              label="Sandboxes"
              value={formatCount(capacity.sandboxesRunning)}
              hint={`${formatCount(
                capacity.sandboxesStarting,
              )} starting · ${formatCount(capacity.sandboxesPaused)} paused`}
            />
            <StatTile
              label="Capacity"
              value={`${formatCount(capacity.cpuAllocated)} / ${formatCount(
                capacity.cpuCount,
              )} vCPU`}
              hint={`${formatBytes(
                capacity.memoryAllocatedBytes,
              )} of ${formatBytes(capacity.memoryTotalBytes)} reserved`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Nodes</CardTitle>
              <CardDescription>
                Read-only inventory from the Gateway admin API. Select a node
                for host details and metrics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <NodeFilters query={query} status={status} counts={counts} />
              {visible.length === 0 ? (
                <EmptyState>
                  {nodes.length === 0
                    ? "No nodes are registered with this Gateway."
                    : "No nodes match the current filters."}
                </EmptyState>
              ) : (
                <NodesTable nodes={visible} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Nodes</h1>
      <p className="text-sm text-muted-foreground">
        Cluster nodes reporting to the Gateway, with host and sandbox capacity.
      </p>
    </div>
  );
}
