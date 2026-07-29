"use server";

import { revalidatePath } from "next/cache";

import { userFacingApiMessage } from "@/lib/api/errors";
import {
  connectSandbox,
  createColdSandbox,
  createSandbox,
  createSandboxSnapshot,
  forkSandbox,
  getCustomExtensionParams,
  killSandbox,
  patchCustomExtensionParams,
  pauseSandbox,
  setSandboxTimeout,
  updateSandboxNetwork,
  type CustomExtensionParams,
  type NewColdSandboxRequest,
  type NewSandboxRequest,
  type SandboxNetworkUpdate,
} from "@/lib/api/sandboxes";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function run<T>(
  operation: () => Promise<T>,
  revalidate: string[],
): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    for (const path of revalidate) {
      revalidatePath(path);
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: userFacingApiMessage(error) };
  }
}

function sandboxPaths(sandboxID: string): string[] {
  return ["/sandboxes", `/sandboxes/${sandboxID}`];
}

export async function pauseSandboxAction(
  sandboxID: string,
): Promise<ActionResult> {
  return run(async () => {
    await pauseSandbox(sandboxID);
    return undefined;
  }, sandboxPaths(sandboxID));
}

export async function resumeSandboxAction(
  sandboxID: string,
  timeoutSeconds: number,
): Promise<ActionResult> {
  return run(async () => {
    await connectSandbox(sandboxID, timeoutSeconds);
    return undefined;
  }, sandboxPaths(sandboxID));
}

export async function setSandboxTimeoutAction(
  sandboxID: string,
  timeoutSeconds: number,
): Promise<ActionResult> {
  return run(async () => {
    await setSandboxTimeout(sandboxID, timeoutSeconds);
    return undefined;
  }, sandboxPaths(sandboxID));
}

export async function killSandboxAction(
  sandboxID: string,
): Promise<ActionResult> {
  return run(async () => {
    await killSandbox(sandboxID);
    return undefined;
  }, sandboxPaths(sandboxID));
}

export type ForkSummary = {
  createdSandboxIDs: string[];
  failures: string[];
};

export async function forkSandboxAction(
  sandboxID: string,
  count: number,
  timeoutSeconds?: number,
): Promise<ActionResult<ForkSummary>> {
  return run(async () => {
    const results = await forkSandbox(sandboxID, {
      count,
      timeout: timeoutSeconds,
    });
    const summary: ForkSummary = { createdSandboxIDs: [], failures: [] };
    for (const result of results ?? []) {
      if (result.sandbox?.sandboxID) {
        summary.createdSandboxIDs.push(result.sandbox.sandboxID);
      } else {
        summary.failures.push(result.error?.message ?? "Fork failed.");
      }
    }
    return summary;
  }, sandboxPaths(sandboxID));
}

export async function createSandboxSnapshotAction(
  sandboxID: string,
  name?: string,
): Promise<ActionResult<{ snapshotID: string }>> {
  return run(
    async () => {
      const snapshot = await createSandboxSnapshot(sandboxID, { name });
      return { snapshotID: snapshot.snapshotID };
    },
    [...sandboxPaths(sandboxID), "/snapshots"],
  );
}

export async function updateSandboxNetworkAction(
  sandboxID: string,
  update: SandboxNetworkUpdate,
): Promise<ActionResult> {
  return run(async () => {
    await updateSandboxNetwork(sandboxID, update);
    return undefined;
  }, sandboxPaths(sandboxID));
}

export async function loadCustomExtensionParamsAction(
  sandboxID: string,
): Promise<ActionResult<CustomExtensionParams>> {
  return run(() => getCustomExtensionParams(sandboxID), []);
}

export async function patchCustomExtensionParamsAction(
  sandboxID: string,
  patch: Record<string, unknown>,
): Promise<ActionResult<CustomExtensionParams>> {
  return run(
    () => patchCustomExtensionParams(sandboxID, patch),
    sandboxPaths(sandboxID),
  );
}

export async function createSandboxAction(
  body: NewSandboxRequest,
): Promise<ActionResult<{ sandboxID: string }>> {
  return run(
    async () => {
      const sandbox = await createSandbox(body);
      return { sandboxID: sandbox.sandboxID };
    },
    ["/sandboxes"],
  );
}

export async function createColdSandboxAction(
  body: NewColdSandboxRequest,
): Promise<ActionResult<{ sandboxID: string }>> {
  return run(
    async () => {
      const sandbox = await createColdSandbox(body);
      return { sandboxID: sandbox.sandboxID };
    },
    ["/sandboxes"],
  );
}
