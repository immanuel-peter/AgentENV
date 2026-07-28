import { gatewayFetch } from "@/lib/api/client";
import { userFacingApiMessage, ApiError } from "@/lib/api/errors";
import { listNodes, type ClusterNode } from "@/lib/api/nodes";
import type {
  SandboxInfo,
  SnapshotInfo,
  TemplateInfo,
} from "@/lib/api/types";
import { getConnectionSession } from "@/lib/session";

export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number; message: string };

async function settle<T>(load: () => Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof ApiError ? error.status : undefined,
      message: userFacingApiMessage(error),
    };
  }
}

export type GatewayHealth = {
  latencyMs: number;
};

export type DashboardData = {
  connected: boolean;
  adminTokenPresent: boolean;
  gatewayUrl: string | null;
  fetchedAt: string;
  health: LoadResult<GatewayHealth>;
  nodes: LoadResult<ClusterNode[]>;
  sandboxes: LoadResult<SandboxInfo[]>;
  templates: LoadResult<TemplateInfo[]>;
  snapshots: LoadResult<SnapshotInfo[]>;
};

const ADMIN_TOKEN_MISSING: LoadResult<never> = {
  ok: false,
  status: 403,
  message: "Admin token required.",
};

const LIST_LIMIT = 100;

async function checkHealth(): Promise<GatewayHealth> {
  const startedAt = Date.now();
  await gatewayFetch<void>("/health", { timeoutMs: 10_000 });
  return { latencyMs: Date.now() - startedAt };
}

async function listSandboxes(): Promise<SandboxInfo[]> {
  const sandboxes = await gatewayFetch<SandboxInfo[]>(
    `/v2/sandboxes?state=running&state=paused&limit=${LIST_LIMIT}`,
  );
  return Array.isArray(sandboxes) ? sandboxes : [];
}

async function listTemplates(): Promise<TemplateInfo[]> {
  const templates = await gatewayFetch<TemplateInfo[]>(
    `/v2/templates?limit=${LIST_LIMIT}`,
  );
  return Array.isArray(templates) ? templates : [];
}

async function listSnapshots(): Promise<SnapshotInfo[]> {
  const snapshots = await gatewayFetch<SnapshotInfo[]>(
    `/snapshots?limit=${LIST_LIMIT}`,
  );
  return Array.isArray(snapshots) ? snapshots : [];
}

/**
 * Loads every dashboard panel independently so one failing (or unauthorized)
 * endpoint degrades a single panel instead of the whole page.
 */
export async function loadDashboard(): Promise<DashboardData> {
  const session = await getConnectionSession();

  if (!session) {
    return {
      connected: false,
      adminTokenPresent: false,
      gatewayUrl: null,
      fetchedAt: new Date().toISOString(),
      health: { ok: false, message: "Not connected." },
      nodes: { ok: false, message: "Not connected." },
      sandboxes: { ok: false, message: "Not connected." },
      templates: { ok: false, message: "Not connected." },
      snapshots: { ok: false, message: "Not connected." },
    };
  }

  const adminTokenPresent = Boolean(session.adminToken);

  const [health, nodes, sandboxes, templates, snapshots] = await Promise.all([
    settle(checkHealth),
    adminTokenPresent
      ? settle(() => listNodes())
      : Promise.resolve<LoadResult<ClusterNode[]>>(ADMIN_TOKEN_MISSING),
    settle(listSandboxes),
    settle(listTemplates),
    settle(listSnapshots),
  ]);

  return {
    connected: true,
    adminTokenPresent,
    gatewayUrl: session.gatewayUrl,
    fetchedAt: new Date().toISOString(),
    health,
    nodes,
    sandboxes,
    templates,
    snapshots,
  };
}

export type SandboxSummary = {
  total: number;
  running: number;
  paused: number;
  other: number;
  cpuAllocated: number;
  memoryAllocatedMB: number;
  recent: SandboxInfo[];
  expiringSoon: SandboxInfo[];
};

function timestamp(value?: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function summarizeSandboxes(
  sandboxes: SandboxInfo[],
  now = Date.now(),
): SandboxSummary {
  const summary: SandboxSummary = {
    total: sandboxes.length,
    running: 0,
    paused: 0,
    other: 0,
    cpuAllocated: 0,
    memoryAllocatedMB: 0,
    recent: [],
    expiringSoon: [],
  };

  for (const sandbox of sandboxes) {
    const state = (sandbox.state ?? "").toLowerCase();
    if (state === "running") {
      summary.running += 1;
    } else if (state === "paused") {
      summary.paused += 1;
    } else {
      summary.other += 1;
    }
    summary.cpuAllocated += sandbox.cpuCount ?? 0;
    summary.memoryAllocatedMB += sandbox.memoryMB ?? 0;
  }

  summary.recent = [...sandboxes]
    .filter((sandbox) => timestamp(sandbox.startedAt) !== null)
    .sort(
      (a, b) => (timestamp(b.startedAt) ?? 0) - (timestamp(a.startedAt) ?? 0),
    )
    .slice(0, 5);

  summary.expiringSoon = [...sandboxes]
    .filter((sandbox) => {
      const endAt = timestamp(sandbox.endAt);
      return endAt !== null && endAt >= now;
    })
    .sort((a, b) => (timestamp(a.endAt) ?? 0) - (timestamp(b.endAt) ?? 0))
    .slice(0, 5);

  return summary;
}

export type TemplateSummary = {
  total: number;
  ready: number;
  building: number;
  failed: TemplateInfo[];
};

export function summarizeTemplates(templates: TemplateInfo[]): TemplateSummary {
  const summary: TemplateSummary = {
    total: templates.length,
    ready: 0,
    building: 0,
    failed: [],
  };

  for (const template of templates) {
    const status = (template.buildStatus ?? "").toLowerCase();
    if (status === "ready") {
      summary.ready += 1;
    } else if (status === "building" || status === "waiting") {
      summary.building += 1;
    } else if (status === "error" || status === "failed") {
      summary.failed.push(template);
    }
  }

  return summary;
}

export function templateLabel(template: TemplateInfo): string {
  const names = template.names;
  const first = Array.isArray(names) ? names[0] : template.aliases?.[0];
  if (typeof first === "string" && first.length > 0) {
    return first;
  }
  return template.templateID ?? "unknown template";
}
