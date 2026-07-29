/**
 * Isomorphic template types and helpers.
 *
 * Nothing here touches cookies or the network, so it is safe to import from
 * both client components and server code. The request functions live in
 * `templates-server.ts`.
 *
 * AgentENV runs the E2B template API in a compatibility mode where a template
 * and its build share one identifier, so `buildID` always equals `templateID`
 * and each `POST /v3/templates` mints a brand new template rather than adding a
 * build to an existing one.
 */

export const TEMPLATE_BUILD_STATUSES = [
  "building",
  "waiting",
  "ready",
  "error",
] as const;

export type TemplateBuildStatus = (typeof TEMPLATE_BUILD_STATUSES)[number];

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type ListedTemplate = {
  templateID: string;
  buildID: string;
  cpuCount?: number;
  memoryMB?: number;
  diskSizeMB?: number;
  public?: boolean;
  names?: string[];
  /** Superseded by `names`, still emitted by some gateways. */
  aliases?: string[];
  createdAt?: string;
  updatedAt?: string;
  lastSpawnedAt?: string | null;
  spawnCount?: number;
  buildCount?: number;
  envdVersion?: string;
  buildStatus?: string;
};

export type TemplateBuild = {
  buildID: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  cpuCount?: number;
  memoryMB?: number;
  diskSizeMB?: number;
  envdVersion?: string;
};

export type TemplateWithBuilds = {
  templateID: string;
  public?: boolean;
  names?: string[];
  aliases?: string[];
  createdAt?: string;
  updatedAt?: string;
  lastSpawnedAt?: string | null;
  spawnCount?: number;
  builds?: TemplateBuild[];
};

export type BuildLogEntry = {
  timestamp?: string;
  message: string;
  level?: string;
  step?: string;
};

export type BuildStatusReason = {
  message: string;
  step?: string;
  logEntries?: BuildLogEntry[];
};

export type TemplateBuildInfo = {
  templateID: string;
  buildID: string;
  status?: string;
  logs?: string[];
  logEntries?: BuildLogEntry[];
  reason?: BuildStatusReason;
};

export type TemplateAliasResponse = {
  templateID: string;
  public?: boolean;
};

export const TEMPLATE_STEP_TYPES = ["RUN", "ENV", "WORKDIR"] as const;

export type TemplateStepType = (typeof TEMPLATE_STEP_TYPES)[number];

export type TemplateStep = {
  type: string;
  args?: string[];
  filesHash?: string;
  force?: boolean;
};

export type CreateTemplateRequest = {
  name: string;
  tags?: string[];
  cpuCount?: number;
  memoryMB?: number;
};

export type CreateTemplateResponse = {
  templateID: string;
  buildID: string;
  public?: boolean;
  names?: string[];
  tags?: string[];
  aliases?: string[];
};

export type StartBuildRequest = {
  fromImage?: string;
  fromTemplate?: string;
  force?: boolean;
  steps?: TemplateStep[];
  startCmd?: string;
  readyCmd?: string;
};

export function isTemplateBuildStatus(
  value: string,
): value is TemplateBuildStatus {
  return (TEMPLATE_BUILD_STATUSES as readonly string[]).includes(value);
}

export function buildStatus(
  value?: string | null,
): TemplateBuildStatus | "unknown" {
  const normalized = (value ?? "").toLowerCase();
  return isTemplateBuildStatus(normalized) ? normalized : "unknown";
}

/** `building` and `waiting` builds keep changing, so the UI polls them. */
export function isBuildInFlight(value?: string | null): boolean {
  const status = buildStatus(value);
  return status === "building" || status === "waiting";
}

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

export function logLevel(value?: string | null): LogLevel | "unknown" {
  const normalized = (value ?? "").toLowerCase();
  return isLogLevel(normalized) ? normalized : "unknown";
}

export function templateNames(
  template: Pick<ListedTemplate, "names" | "aliases">,
): string[] {
  const names = template.names?.length ? template.names : template.aliases;
  return names ?? [];
}

function buildTime(build: TemplateBuild): number {
  const parsed = Date.parse(build.updatedAt ?? build.createdAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * `GET /templates/{id}` reports resources per build rather than on the
 * template, so detail views read them from the newest build.
 */
export function latestBuild(
  template: TemplateWithBuilds,
): TemplateBuild | undefined {
  const builds = template.builds ?? [];
  if (builds.length <= 1) {
    return builds[0];
  }
  return [...builds].sort((a, b) => buildTime(b) - buildTime(a))[0];
}

export function sortBuildsByRecency(builds: TemplateBuild[]): TemplateBuild[] {
  return [...builds].sort((a, b) => buildTime(b) - buildTime(a));
}

export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}
