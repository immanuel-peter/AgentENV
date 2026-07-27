import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CpuIcon,
  HardDriveIcon,
  ServerIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, userFacingApiMessage } from "@/lib/api/errors";
import {
  getNodeDetail,
  nodePressure,
  nodeStatus,
  type ClusterNodeDetail,
} from "@/lib/api/nodes";
import { getConnectionSession } from "@/lib/session";
import {
  formatBytes,
  formatCount,
  formatPercent,
  percentOf,
} from "@/components/dashboard/format";
import { NotConnected } from "@/components/dashboard/not-connected";
import {
  DefinitionRow,
  EmptyState,
  PanelNotice,
  StatTile,
  UsageBar,
} from "@/components/dashboard/primitives";
import { RefreshControls } from "@/components/dashboard/refresh-controls";
import {
  NodeStatusBadge,
  PressureBadge,
} from "@/components/nodes/node-status-badge";

export const metadata: Metadata = {
  title: "Node · AgentENV",
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ nodeId: string }>;
  searchParams: Promise<{ cluster?: string }>;
};

export default async function NodeDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { nodeId } = await params;
  const { cluster } = await searchParams;
  const session = await getConnectionSession();
  const fetchedAt = new Date().toISOString();

  if (!session) {
    return (
      <div className="space-y-4">
        <BackLink />
        <NotConnected
          title="Not connected to a Gateway"
          description="Configure the Gateway URL, API key, and admin token in Settings to inspect nodes."
        />
      </div>
    );
  }

  if (!session.adminToken) {
    return (
      <div className="space-y-4">
        <BackLink />
        <PanelNotice
          result={{
            ok: false,
            status: 403,
            message:
              "No admin token is stored for this Gateway, so node details cannot be loaded.",
          }}
          resourceLabel="node details"
        />
      </div>
    );
  }

  let node: ClusterNodeDetail;
  try {
    node = await getNodeDetail(nodeId, cluster);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) {
      notFound();
    }
    return (
      <div className="space-y-4">
        <BackLink />
        <PanelNotice
          result={{
            ok: false,
            status: caught instanceof ApiError ? caught.status : undefined,
            message: userFacingApiMessage(caught),
          }}
          resourceLabel={`node ${nodeId}`}
        />
      </div>
    );
  }

  const metrics = node.metrics;
  const pressure = nodePressure(node);
  const cpuPercent =
    typeof metrics?.cpuPercent === "number" ? metrics.cpuPercent : null;
  const cpuBusyCores =
    cpuPercent === null
      ? undefined
      : (cpuPercent / 100) * (metrics?.cpuCount ?? 0);
  const createTotal = (node.createSuccesses ?? 0) + (node.createFails ?? 0);

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight break-all">
              {node.id}
            </h1>
            <NodeStatusBadge status={nodeStatus(node)} />
            <PressureBadge level={pressure.level} />
          </div>
          <p className="text-sm text-muted-foreground">
            {node.version ? `orchestrator ${node.version}` : "Node detail"}
            {node.clusterID ? ` · cluster ${node.clusterID}` : ""}
          </p>
        </div>
        <RefreshControls
          fetchedAt={fetchedAt}
          storageKey="aenv:node-detail:auto-refresh"
        />
      </div>

      {pressure.reasons.length > 0 ? (
        <Alert
          variant={pressure.level === "critical" ? "destructive" : "default"}
        >
          <TriangleAlertIcon />
          <AlertTitle>
            {pressure.level === "critical"
              ? "This node needs attention"
              : "This node is degraded"}
          </AlertTitle>
          <AlertDescription>{pressure.reasons.join(" · ")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerIcon className="size-4 text-muted-foreground" />
              Identity
            </CardTitle>
            <CardDescription>Reported by the node heartbeat.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <DefinitionRow label="Node ID" mono>
                {node.id}
              </DefinitionRow>
              <DefinitionRow label="Cluster ID" mono>
                {node.clusterID || "—"}
              </DefinitionRow>
              <DefinitionRow label="Service instance" mono>
                {node.serviceInstanceID || "—"}
              </DefinitionRow>
              <DefinitionRow label="Version">
                {node.version || "—"}
              </DefinitionRow>
              <DefinitionRow label="Commit" mono>
                {node.commit || "—"}
              </DefinitionRow>
              <DefinitionRow label="Architecture">
                {node.machineInfo?.cpuArchitecture || "—"}
              </DefinitionRow>
              <DefinitionRow label="CPU model">
                {node.machineInfo?.cpuModelName || "—"}
              </DefinitionRow>
              <DefinitionRow label="CPU family / model">
                {node.machineInfo?.cpuFamily || "—"} /{" "}
                {node.machineInfo?.cpuModel || "—"}
              </DefinitionRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CpuIcon className="size-4 text-muted-foreground" />
              Host metrics
            </CardTitle>
            <CardDescription>
              Live host usage. Markers show CPU and memory reserved by running
              sandboxes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!metrics ? (
              <EmptyState>This node has not reported metrics yet.</EmptyState>
            ) : (
              <>
                <UsageBar
                  label="CPU"
                  used={cpuBusyCores}
                  total={metrics.cpuCount}
                  usedLabel={
                    cpuPercent === null
                      ? "—"
                      : `${formatPercent(cpuPercent)} busy`
                  }
                  totalLabel={`${formatCount(metrics.cpuCount)} cores`}
                  secondary={metrics.allocatedCPU}
                  secondaryLabel={`${formatCount(
                    metrics.allocatedCPU ?? 0,
                  )} vCPU allocated`}
                />
                <UsageBar
                  label="Memory"
                  used={metrics.memoryUsedBytes}
                  total={metrics.memoryTotalBytes}
                  usedLabel={formatBytes(metrics.memoryUsedBytes)}
                  totalLabel={formatBytes(metrics.memoryTotalBytes)}
                  secondary={metrics.allocatedMemoryBytes}
                  secondaryLabel={`${formatBytes(
                    metrics.allocatedMemoryBytes,
                  )} allocated`}
                />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile
                    label="Active vCPU"
                    value={formatCount(metrics.allocatedCPU ?? 0)}
                    hint="running sandboxes"
                  />
                  <StatTile
                    label="Paused vCPU"
                    value={formatCount(metrics.pausedAllocatedCPU ?? 0)}
                    hint="paused reservations"
                  />
                  <StatTile
                    label="Active memory"
                    value={formatBytes(metrics.allocatedMemoryBytes)}
                    hint="running sandboxes"
                  />
                  <StatTile
                    label="Paused memory"
                    value={formatBytes(metrics.pausedAllocatedMemoryBytes)}
                    hint="paused reservations"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sandboxes</CardTitle>
            <CardDescription>
              Counts and lifetime create outcomes for this node.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Running"
              value={formatCount(node.sandboxCount ?? 0)}
              tone={(node.sandboxCount ?? 0) > 0 ? "positive" : "neutral"}
            />
            <StatTile
              label="Paused"
              value={formatCount(node.sandboxPausedCount ?? 0)}
            />
            <StatTile
              label="Create OK"
              value={formatCount(node.createSuccesses ?? 0)}
              hint={`${formatCount(createTotal)} attempts`}
            />
            <StatTile
              label="Create failed"
              value={formatCount(node.createFails ?? 0)}
              tone={(node.createFails ?? 0) > 0 ? "critical" : "neutral"}
              hint={
                createTotal > 0
                  ? formatPercent(
                      ((node.createFails ?? 0) / createTotal) * 100,
                      1,
                    )
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDriveIcon className="size-4 text-muted-foreground" />
              Disks
            </CardTitle>
            <CardDescription>
              Mount points reported by the host.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!metrics?.disks || metrics.disks.length === 0 ? (
              <EmptyState>No disk metrics reported.</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mount</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.disks.map((disk) => {
                    const percent = percentOf(disk.usedBytes, disk.totalBytes);
                    return (
                      <TableRow key={`${disk.device}:${disk.mountPoint}`}>
                        <TableCell className="font-mono text-xs">
                          {disk.mountPoint}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {disk.device}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {disk.filesystemType}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatBytes(disk.usedBytes)} /{" "}
                          {formatBytes(disk.totalBytes)}
                          <span className="ml-1 text-muted-foreground">
                            ({percent === null ? "—" : formatPercent(percent)})
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {node.cachedBuilds && node.cachedBuilds.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cached builds</CardTitle>
            <CardDescription>
              Build artifacts already present on this node.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {node.cachedBuilds.map((build) => (
              <span
                key={build}
                className="rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
              >
                {build}
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Button
      size="xs"
      variant="ghost"
      className="w-fit text-muted-foreground"
      nativeButton={false}
      render={<Link href="/nodes" />}
    >
      <ArrowLeftIcon />
      All nodes
    </Button>
  );
}
