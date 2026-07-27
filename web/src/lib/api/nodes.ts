import { gatewayFetch } from "@/lib/api/client";
import type { DiskMetrics, NodeStatus } from "@/lib/api/types";

/**
 * Node payloads returned by `GET /nodes` and `GET /nodes/{nodeID}`.
 * Field names follow `src/api/openapi.yml` (`Node` / `NodeDetail`), which uses
 * `id` rather than the `nodeID` path parameter name.
 */

export const NODE_STATUSES = [
  "ready",
  "draining",
  "connecting",
  "unhealthy",
] as const satisfies readonly NodeStatus[];

export type MachineInfo = {
  cpuFamily?: string;
  cpuModel?: string;
  cpuModelName?: string;
  cpuArchitecture?: string;
};

export type ClusterNodeMetrics = {
  allocatedCPU?: number;
  allocatedMemoryBytes?: number;
  cpuPercent?: number;
  cpuCount?: number;
  memoryUsedBytes?: number;
  memoryTotalBytes?: number;
  disks?: DiskMetrics[];
  pausedAllocatedCPU?: number;
  pausedAllocatedMemoryBytes?: number;
};

export type ClusterNode = {
  id: string;
  clusterID?: string;
  serviceInstanceID?: string;
  /** `NodeStatus` in practice; the gateway also emits `unspecified`. */
  status?: string;
  version?: string;
  commit?: string;
  machineInfo?: MachineInfo;
  metrics?: ClusterNodeMetrics;
  sandboxCount?: number;
  sandboxStartingCount?: number;
  sandboxPausedCount?: number;
  createSuccesses?: number;
  createFails?: number;
};

export type ClusterNodeDetail = ClusterNode & {
  cachedBuilds?: string[];
};

export async function listNodes(clusterID?: string): Promise<ClusterNode[]> {
  const query = clusterID ? `?clusterID=${encodeURIComponent(clusterID)}` : "";
  const nodes = await gatewayFetch<ClusterNode[]>(`/nodes${query}`, {
    admin: true,
  });
  return Array.isArray(nodes) ? nodes : [];
}

export async function getNodeDetail(
  nodeID: string,
  clusterID?: string,
): Promise<ClusterNodeDetail> {
  const query = clusterID ? `?clusterID=${encodeURIComponent(clusterID)}` : "";
  return gatewayFetch<ClusterNodeDetail>(
    `/nodes/${encodeURIComponent(nodeID)}${query}`,
    { admin: true },
  );
}

export function isKnownNodeStatus(status: string): status is NodeStatus {
  return (NODE_STATUSES as readonly string[]).includes(status);
}

export function nodeStatus(node: ClusterNode): NodeStatus | "unknown" {
  const status = (node.status ?? "").toLowerCase();
  return isKnownNodeStatus(status) ? status : "unknown";
}

export type NodeStatusCounts = Record<NodeStatus | "unknown", number> & {
  total: number;
};

export function countNodesByStatus(nodes: ClusterNode[]): NodeStatusCounts {
  const counts: NodeStatusCounts = {
    ready: 0,
    draining: 0,
    connecting: 0,
    unhealthy: 0,
    unknown: 0,
    total: nodes.length,
  };
  for (const node of nodes) {
    counts[nodeStatus(node)] += 1;
  }
  return counts;
}

export type ClusterCapacity = {
  nodeCount: number;
  cpuCount: number;
  cpuAllocated: number;
  cpuAllocatedPaused: number;
  /** Node CPU utilisation averaged across nodes, weighted by core count. */
  cpuPercent: number | null;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryAllocatedBytes: number;
  memoryAllocatedPausedBytes: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  sandboxesRunning: number;
  sandboxesPaused: number;
  sandboxesStarting: number;
  createSuccesses: number;
  createFails: number;
};

export function aggregateCapacity(nodes: ClusterNode[]): ClusterCapacity {
  const capacity: ClusterCapacity = {
    nodeCount: nodes.length,
    cpuCount: 0,
    cpuAllocated: 0,
    cpuAllocatedPaused: 0,
    cpuPercent: null,
    memoryTotalBytes: 0,
    memoryUsedBytes: 0,
    memoryAllocatedBytes: 0,
    memoryAllocatedPausedBytes: 0,
    diskTotalBytes: 0,
    diskUsedBytes: 0,
    sandboxesRunning: 0,
    sandboxesPaused: 0,
    sandboxesStarting: 0,
    createSuccesses: 0,
    createFails: 0,
  };

  let weightedCpuPercent = 0;
  let cpuPercentWeight = 0;

  for (const node of nodes) {
    const metrics = node.metrics;
    capacity.sandboxesRunning += node.sandboxCount ?? 0;
    capacity.sandboxesPaused += node.sandboxPausedCount ?? 0;
    capacity.sandboxesStarting += node.sandboxStartingCount ?? 0;
    capacity.createSuccesses += node.createSuccesses ?? 0;
    capacity.createFails += node.createFails ?? 0;

    if (!metrics) {
      continue;
    }

    const cpuCount = metrics.cpuCount ?? 0;
    capacity.cpuCount += cpuCount;
    capacity.cpuAllocated += metrics.allocatedCPU ?? 0;
    capacity.cpuAllocatedPaused += metrics.pausedAllocatedCPU ?? 0;
    capacity.memoryTotalBytes += metrics.memoryTotalBytes ?? 0;
    capacity.memoryUsedBytes += metrics.memoryUsedBytes ?? 0;
    capacity.memoryAllocatedBytes += metrics.allocatedMemoryBytes ?? 0;
    capacity.memoryAllocatedPausedBytes += metrics.pausedAllocatedMemoryBytes ?? 0;

    if (typeof metrics.cpuPercent === "number") {
      const weight = cpuCount > 0 ? cpuCount : 1;
      weightedCpuPercent += metrics.cpuPercent * weight;
      cpuPercentWeight += weight;
    }

    for (const disk of metrics.disks ?? []) {
      capacity.diskTotalBytes += disk.totalBytes ?? 0;
      capacity.diskUsedBytes += disk.usedBytes ?? 0;
    }
  }

  if (cpuPercentWeight > 0) {
    capacity.cpuPercent = weightedCpuPercent / cpuPercentWeight;
  }

  return capacity;
}

export type PressureLevel = "ok" | "warn" | "critical";

export type NodePressure = {
  level: PressureLevel;
  reasons: string[];
};

function ratioPercent(used?: number, total?: number): number | null {
  if (!total || total <= 0 || typeof used !== "number") {
    return null;
  }
  return (used / total) * 100;
}

/** Flags nodes that are unhealthy or close to exhausting a resource. */
export function nodePressure(node: ClusterNode): NodePressure {
  const reasons: string[] = [];
  let level: PressureLevel = "ok";

  const severity: Record<PressureLevel, number> = {
    ok: 0,
    warn: 1,
    critical: 2,
  };
  const escalate = (next: PressureLevel, reason: string) => {
    reasons.push(reason);
    if (severity[next] > severity[level]) {
      level = next;
    }
  };

  const status = nodeStatus(node);
  if (status === "unhealthy") {
    escalate("critical", "Node reported unhealthy");
  } else if (status === "draining") {
    escalate("warn", "Node is draining");
  } else if (status === "connecting" || status === "unknown") {
    escalate("warn", "Node has not reported ready");
  }

  const metrics = node.metrics;
  if (metrics) {
    const cpuPercent = metrics.cpuPercent;
    if (typeof cpuPercent === "number") {
      if (cpuPercent >= 90) {
        escalate("critical", `Host CPU at ${Math.round(cpuPercent)}%`);
      } else if (cpuPercent >= 75) {
        escalate("warn", `Host CPU at ${Math.round(cpuPercent)}%`);
      }
    }

    const memPercent = ratioPercent(
      metrics.memoryUsedBytes,
      metrics.memoryTotalBytes,
    );
    if (memPercent !== null) {
      if (memPercent >= 90) {
        escalate("critical", `Host memory at ${Math.round(memPercent)}%`);
      } else if (memPercent >= 75) {
        escalate("warn", `Host memory at ${Math.round(memPercent)}%`);
      }
    }

    const cpuCount = metrics.cpuCount ?? 0;
    const allocatedCPU = metrics.allocatedCPU ?? 0;
    if (cpuCount > 0 && allocatedCPU > cpuCount) {
      escalate(
        "warn",
        `CPU oversubscribed (${allocatedCPU} allocated / ${cpuCount} cores)`,
      );
    }

    for (const disk of metrics.disks ?? []) {
      const diskPercent = ratioPercent(disk.usedBytes, disk.totalBytes);
      if (diskPercent === null) {
        continue;
      }
      if (diskPercent >= 90) {
        escalate(
          "critical",
          `${disk.mountPoint} at ${Math.round(diskPercent)}%`,
        );
      } else if (diskPercent >= 80) {
        escalate("warn", `${disk.mountPoint} at ${Math.round(diskPercent)}%`);
      }
    }
  }

  return { level, reasons };
}
