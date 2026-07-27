import { userFacingApiMessage } from "@/lib/api/errors";
import {
  listSandboxes,
  type ListedSandbox,
  type SandboxLifecycleState,
} from "@/lib/api/sandboxes";
import {
  SandboxList,
  type SandboxStateFilter,
} from "@/components/sandboxes/sandbox-list";

const DEFAULT_LIMIT = 50;
const ALLOWED_LIMITS = [25, 50, 100, 200];

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStateFilter(value: string | undefined): SandboxStateFilter {
  return value === "running" || value === "paused" ? value : "all";
}

function parseLimit(value: string | undefined): number {
  const parsed = Number(value);
  return ALLOWED_LIMITS.includes(parsed) ? parsed : DEFAULT_LIMIT;
}

/** Accepts the raw `user=abc&app=prod` form used by the Gateway metadata filter. */
function parseMetadataQuery(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }
  const metadata: Record<string, string> = {};
  for (const [key, entry] of new URLSearchParams(value).entries()) {
    if (key.trim() !== "") {
      metadata[key] = entry;
    }
  }
  return metadata;
}

export default async function SandboxesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  const stateFilter = parseStateFilter(firstValue(resolved.state));
  const limit = parseLimit(firstValue(resolved.limit));
  const metadataQuery = firstValue(resolved.metadata)?.trim() ?? "";
  const metadata = parseMetadataQuery(metadataQuery);

  const states: SandboxLifecycleState[] =
    stateFilter === "all" ? ["running", "paused"] : [stateFilter];

  let sandboxes: ListedSandbox[] = [];
  let hasMore = false;
  let error: string | undefined;

  try {
    const result = await listSandboxes({
      states,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      limit,
    });
    sandboxes = result.items;
    hasMore = Boolean(result.nextToken);
  } catch (loadError) {
    error = userFacingApiMessage(loadError);
  }

  return (
    <SandboxList
      sandboxes={sandboxes}
      state={stateFilter}
      metadataQuery={metadataQuery}
      limit={limit}
      hasMore={hasMore}
      fetchedAt={new Date().toISOString()}
      error={error}
    />
  );
}
