/**
 * Typed wrappers around the sandbox endpoints of the AgentENV control-plane API
 * (see `src/api/openapi.yml`). Every function runs on the server because
 * `gatewayFetch` reads the connection session from cookies.
 */

import { gatewayFetch } from "@/lib/api/client";

export const SANDBOX_STATES = ["running", "paused"] as const;

export type SandboxLifecycleState = (typeof SANDBOX_STATES)[number];

export type SandboxOnTimeout = "kill" | "pause";

export type SandboxNetworkConfig = {
  allowPublicTraffic?: boolean;
  allowOut?: string[];
  denyOut?: string[];
  maskRequestHost?: string;
};

export type SandboxNetworkUpdate = {
  allowOut?: string[];
  denyOut?: string[];
  allow_internet_access?: boolean;
};

export type SandboxLifecyclePolicy = {
  autoResume: boolean;
  onTimeout: SandboxOnTimeout;
};

export type ListedSandbox = {
  sandboxID: string;
  templateID: string;
  alias?: string;
  clientID?: string;
  startedAt: string;
  endAt: string;
  cpuCount: number;
  memoryMB: number;
  diskSizeMB: number;
  metadata?: Record<string, string>;
  state: SandboxLifecycleState;
  envdVersion?: string;
};

export type SandboxDetail = ListedSandbox & {
  envdAccessToken?: string;
  allowInternetAccess?: boolean | null;
  domain?: string | null;
  network?: SandboxNetworkConfig;
  lifecycle?: SandboxLifecyclePolicy;
};

/** Shape returned by create / connect / fork — identity and connection info only. */
export type CreatedSandbox = {
  sandboxID: string;
  templateID: string;
  alias?: string;
  clientID?: string;
  envdVersion?: string;
  envdAccessToken?: string;
  trafficAccessToken?: string | null;
  domain?: string | null;
};

export type AttachedDriveInput = {
  driveID: string;
  source: { image: string };
  readOnly?: boolean;
  mountPath?: string;
  subPath?: string;
  diskSizeMB?: number;
};

export type NewSandboxRequest = {
  templateID: string;
  timeout?: number;
  autoPause?: boolean;
  autoResume?: { enabled: boolean };
  secure?: boolean;
  allow_internet_access?: boolean;
  network?: SandboxNetworkConfig;
  metadata?: Record<string, string>;
  envVars?: Record<string, string>;
  customExtensionParams?: Record<string, unknown>;
};

export type NewColdSandboxRequest = {
  image: string;
  timeout?: number;
  autoPause?: boolean;
  autoResume?: { enabled: boolean };
  allowInternetAccess?: boolean;
  network?: SandboxNetworkConfig;
  metadata?: Record<string, string>;
  envVars?: Record<string, string>;
  customExtensionParams?: Record<string, unknown>;
  cpuCount?: number;
  memoryMB?: number;
  diskSizeMB?: number;
  attachedDrives?: AttachedDriveInput[];
  extraBootArgs?: string;
};

export type SandboxForkResult = {
  sandbox?: CreatedSandbox;
  error?: { message?: string; code?: number };
};

export type SnapshotInfo = {
  snapshotID: string;
  names?: string[];
  cpuCount?: number;
  memoryMB?: number;
  diskSizeMB?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomExtensionParams = Record<string, unknown>;

/**
 * Cold starts pull and convert OCI layers on a cache miss, and template creates
 * may have to warm a snapshot, so both need far more headroom than the 30s
 * default in `gatewayFetch`.
 */
export const CREATE_TIMEOUT_MS = 180_000;
const FORK_TIMEOUT_MS = 120_000;
const SNAPSHOT_TIMEOUT_MS = 120_000;

export type ListSandboxesParams = {
  states?: SandboxLifecycleState[];
  /** Metadata equality filters, applied as an AND across all pairs. */
  metadata?: Record<string, string>;
  limit?: number;
  nextToken?: string;
};

export type ListSandboxesResult = {
  items: ListedSandbox[];
  nextToken?: string;
};

export function encodeMetadataFilter(
  metadata: Record<string, string>,
): string | undefined {
  const pairs = Object.entries(metadata).filter(
    ([key, value]) => key.trim() !== "" && value.trim() !== "",
  );
  if (pairs.length === 0) {
    return undefined;
  }
  return new URLSearchParams(pairs).toString();
}

export async function listSandboxes(
  params: ListSandboxesParams = {},
): Promise<ListSandboxesResult> {
  const query = new URLSearchParams();
  if (params.states?.length) {
    query.set("state", params.states.join(","));
  }
  if (params.metadata) {
    const encoded = encodeMetadataFilter(params.metadata);
    if (encoded) {
      query.set("metadata", encoded);
    }
  }
  query.set("limit", String(params.limit ?? 50));
  if (params.nextToken) {
    query.set("nextToken", params.nextToken);
  }

  let nextToken: string | undefined;
  const items = await gatewayFetch<ListedSandbox[]>(
    `/v2/sandboxes?${query.toString()}`,
    {
      onResponse: (res) => {
        nextToken = res.headers.get("x-next-token") ?? undefined;
      },
    },
  );

  return { items: items ?? [], nextToken: nextToken || undefined };
}

export function getSandbox(sandboxID: string): Promise<SandboxDetail> {
  return gatewayFetch<SandboxDetail>(
    `/sandboxes/${encodeURIComponent(sandboxID)}`,
  );
}

export function createSandbox(
  body: NewSandboxRequest,
): Promise<CreatedSandbox> {
  return gatewayFetch<CreatedSandbox>("/sandboxes", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: CREATE_TIMEOUT_MS,
  });
}

export function createColdSandbox(
  body: NewColdSandboxRequest,
): Promise<CreatedSandbox> {
  return gatewayFetch<CreatedSandbox>("/sandboxes-cold", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: CREATE_TIMEOUT_MS,
  });
}

export function pauseSandbox(sandboxID: string): Promise<void> {
  return gatewayFetch<void>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/pause`,
    { method: "POST", timeoutMs: 120_000 },
  );
}

/**
 * Resume is exposed through `connect`: it resumes a paused sandbox, returns a
 * running one untouched, and only ever extends the TTL.
 */
export function connectSandbox(
  sandboxID: string,
  timeoutSeconds: number,
): Promise<CreatedSandbox> {
  return gatewayFetch<CreatedSandbox>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/connect`,
    {
      method: "POST",
      body: JSON.stringify({ timeout: timeoutSeconds }),
      timeoutMs: 120_000,
    },
  );
}

export function setSandboxTimeout(
  sandboxID: string,
  timeoutSeconds: number,
): Promise<void> {
  return gatewayFetch<void>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/timeout`,
    { method: "POST", body: JSON.stringify({ timeout: timeoutSeconds }) },
  );
}

export function killSandbox(sandboxID: string): Promise<void> {
  return gatewayFetch<void>(`/sandboxes/${encodeURIComponent(sandboxID)}`, {
    method: "DELETE",
    timeoutMs: 60_000,
  });
}

export function forkSandbox(
  sandboxID: string,
  body: { count: number; timeout?: number },
): Promise<SandboxForkResult[]> {
  return gatewayFetch<SandboxForkResult[]>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/fork`,
    {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: FORK_TIMEOUT_MS,
    },
  );
}

export function createSandboxSnapshot(
  sandboxID: string,
  body: { name?: string },
): Promise<SnapshotInfo> {
  return gatewayFetch<SnapshotInfo>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/snapshots`,
    {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: SNAPSHOT_TIMEOUT_MS,
    },
  );
}

export function updateSandboxNetwork(
  sandboxID: string,
  body: SandboxNetworkUpdate,
): Promise<void> {
  return gatewayFetch<void>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/network`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function getCustomExtensionParams(
  sandboxID: string,
): Promise<CustomExtensionParams> {
  return gatewayFetch<CustomExtensionParams>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/custom-extension-params`,
  );
}

export function patchCustomExtensionParams(
  sandboxID: string,
  patch: Record<string, unknown>,
): Promise<CustomExtensionParams> {
  return gatewayFetch<CustomExtensionParams>(
    `/sandboxes/${encodeURIComponent(sandboxID)}/custom-extension-params`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}
