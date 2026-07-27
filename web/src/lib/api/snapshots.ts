import { gatewayFetch } from "@/lib/api/client";
import {
  DEFAULT_PAGE_LIMIT,
  gatewayFetchPage,
  pageQuery,
  type Page,
} from "@/lib/api/paging";
import type { SnapshotInfo } from "@/lib/api/types";

export type SnapshotListParams = {
  /** Filter by the sandbox the snapshot was captured from. */
  sandboxID?: string;
  /** Filter by snapshot name/alias or ID, optionally tag-qualified. */
  name?: string;
  limit?: number;
  nextToken?: string;
};

export async function listSnapshots(
  params: SnapshotListParams = {},
): Promise<Page<SnapshotInfo>> {
  const query = pageQuery({
    sandboxID: params.sandboxID,
    name: params.name,
    limit: params.limit ?? DEFAULT_PAGE_LIMIT,
    nextToken: params.nextToken,
  });
  return gatewayFetchPage<SnapshotInfo>(`/snapshots${query}`);
}

export async function getSnapshot(snapshotID: string): Promise<SnapshotInfo> {
  return gatewayFetch<SnapshotInfo>(
    `/snapshots/${encodeURIComponent(snapshotID)}`,
  );
}

export function snapshotId(snapshot: SnapshotInfo): string {
  return snapshot.snapshotID ?? snapshot.id ?? "";
}

export function snapshotAliases(snapshot: SnapshotInfo): string[] {
  return snapshot.names ?? snapshot.aliases ?? [];
}

/**
 * Provenance is not part of the documented SnapshotInfo schema, so read it
 * defensively — gateways that do return it should still surface it in the UI.
 */
export function snapshotSourceSandboxId(
  snapshot: SnapshotInfo,
): string | undefined {
  for (const key of ["sourceSandboxID", "sandboxID", "sourceSandboxId"]) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}
