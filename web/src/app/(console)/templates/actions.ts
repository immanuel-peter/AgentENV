"use server";

import { revalidatePath } from "next/cache";

import { userFacingApiMessage } from "@/lib/api/errors";
import {
  createTemplate,
  deleteTemplate,
  getBuildStatus,
  resolveTemplateAlias,
  startTemplateBuild,
} from "@/lib/api/templates-server";
import type {
  CreateTemplateRequest,
  StartBuildRequest,
  TemplateBuildInfo,
} from "@/lib/api/templates";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function run<T>(
  operation: () => Promise<T>,
  revalidate: string[] = [],
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

export type BuildSubmission = {
  template: CreateTemplateRequest;
  build: StartBuildRequest;
};

/**
 * Creating a template and starting its build are two calls, and the second one
 * only queues the work — the server builds in the background, so callers poll
 * the returned build for its status.
 */
export async function createAndBuildTemplateAction(
  submission: BuildSubmission,
): Promise<ActionResult<{ templateID: string; buildID: string }>> {
  return run(async () => {
    const created = await createTemplate(submission.template);
    const templateID = created.templateID;
    const buildID = created.buildID ?? created.templateID;
    await startTemplateBuild(templateID, buildID, submission.build);
    return { templateID, buildID };
  }, ["/templates"]);
}

export async function deleteTemplateAction(
  templateID: string,
): Promise<ActionResult> {
  return run(
    async () => {
      await deleteTemplate(templateID);
      return undefined;
    },
    ["/templates", `/templates/${templateID}`],
  );
}

export async function fetchBuildStatusAction(
  templateID: string,
  buildID: string,
): Promise<ActionResult<TemplateBuildInfo>> {
  return run(() => getBuildStatus(templateID, buildID));
}

export async function resolveTemplateAliasAction(
  alias: string,
): Promise<ActionResult<{ templateID: string; public: boolean }>> {
  return run(async () => {
    const resolved = await resolveTemplateAlias(alias);
    return {
      templateID: resolved.templateID,
      public: resolved.public ?? false,
    };
  });
}

/** Refreshes the server-rendered detail view once a polled build settles. */
export async function revalidateTemplateAction(
  templateID: string,
): Promise<void> {
  revalidatePath("/templates");
  revalidatePath(`/templates/${templateID}`);
}
