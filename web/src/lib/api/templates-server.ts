/**
 * Typed wrappers around the template endpoints of the AgentENV control-plane
 * API (see `src/api/openapi.yml`). Every function runs on the server because
 * `gatewayFetch` reads the connection session from cookies; the types and pure
 * helpers they share with client components live in `templates.ts`.
 */

import { gatewayFetch } from "@/lib/api/client";
import {
  clampLimit,
  gatewayFetchPage,
  pageQuery,
  type Page,
} from "@/lib/api/paging";
import type {
  CreateTemplateRequest,
  CreateTemplateResponse,
  ListedTemplate,
  StartBuildRequest,
  TemplateAliasResponse,
  TemplateBuildInfo,
  TemplateWithBuilds,
} from "@/lib/api/templates";

/**
 * Builds pull and convert OCI layers before the first step runs, so both the
 * create and the start call need far more headroom than the 30s default.
 */
export const BUILD_TIMEOUT_MS = 300_000;

export type ListTemplatesParams = {
  teamID?: string;
  limit?: number;
  nextToken?: string;
};

export function listTemplates(
  params: ListTemplatesParams = {},
): Promise<Page<ListedTemplate>> {
  const query = pageQuery({
    teamID: params.teamID,
    limit: clampLimit(params.limit),
    nextToken: params.nextToken,
  });
  return gatewayFetchPage<ListedTemplate>(`/v2/templates${query}`);
}

export function getTemplate(templateID: string): Promise<TemplateWithBuilds> {
  return gatewayFetch<TemplateWithBuilds>(
    `/templates/${encodeURIComponent(templateID)}`,
  );
}

export function createTemplate(
  body: CreateTemplateRequest,
): Promise<CreateTemplateResponse> {
  return gatewayFetch<CreateTemplateResponse>("/v3/templates", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: BUILD_TIMEOUT_MS,
  });
}

export function startTemplateBuild(
  templateID: string,
  buildID: string,
  body: StartBuildRequest,
): Promise<void> {
  return gatewayFetch<void>(
    `/v2/templates/${encodeURIComponent(templateID)}/builds/${encodeURIComponent(buildID)}`,
    {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: BUILD_TIMEOUT_MS,
    },
  );
}

export function getBuildStatus(
  templateID: string,
  buildID: string,
): Promise<TemplateBuildInfo> {
  return gatewayFetch<TemplateBuildInfo>(
    `/templates/${encodeURIComponent(templateID)}/builds/${encodeURIComponent(buildID)}/status`,
  );
}

export function deleteTemplate(templateID: string): Promise<void> {
  return gatewayFetch<void>(`/templates/${encodeURIComponent(templateID)}`, {
    method: "DELETE",
    timeoutMs: 60_000,
  });
}

export function resolveTemplateAlias(
  alias: string,
): Promise<TemplateAliasResponse> {
  return gatewayFetch<TemplateAliasResponse>(
    `/templates/aliases/${encodeURIComponent(alias)}`,
  );
}
