/** Minimal shared types for the control-plane UI. Expand per feature as needed. */

export type NodeStatus = "ready" | "draining" | "connecting" | "unhealthy";

export type SandboxState = "running" | "paused" | string;

export type TemplateBuildStatus =
  | "building"
  | "waiting"
  | "ready"
  | "error"
  | string;

export type DiskMetrics = {
  mountPoint: string;
  device: string;
  filesystemType: string;
  usedBytes: number;
  totalBytes: number;
};

export type NodeMetrics = {
  allocatedCPU: number;
  allocatedMemoryBytes: number;
  cpuPercent: number;
  memoryUsedBytes: number;
  cpuCount: number;
  memoryTotalBytes: number;
  disks: DiskMetrics[];
  createSuccesses?: number;
  createFails?: number;
  sandboxesRunning?: number;
  sandboxesPaused?: number;
  sandboxesStarting?: number;
};

export type NodeDetail = {
  nodeID: string;
  clusterID?: string;
  status: NodeStatus;
  serviceInstanceID?: string;
  version?: string;
  commit?: string;
  architecture?: string;
  metrics?: NodeMetrics;
  [key: string]: unknown;
};

export type SandboxInfo = {
  sandboxID: string;
  templateID?: string;
  name?: string;
  state?: SandboxState;
  cpuCount?: number;
  memoryMB?: number;
  diskSizeMB?: number;
  startedAt?: string;
  endAt?: string;
  metadata?: Record<string, string>;
  [key: string]: unknown;
};

export type SnapshotInfo = {
  snapshotID?: string;
  id?: string;
  aliases?: string[];
  names?: string[];
  cpuCount?: number;
  memoryMB?: number;
  diskSizeMB?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type TemplateInfo = {
  templateID?: string;
  aliases?: string[];
  cpuCount?: number;
  memoryMB?: number;
  buildStatus?: TemplateBuildStatus;
  buildCount?: number;
  spawnCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastSpawnedAt?: string;
  [key: string]: unknown;
};
