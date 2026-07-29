import Link from "next/link";
import { CameraIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SnapshotFilters } from "@/components/snapshots/snapshot-filters";
import { SnapshotTable } from "@/components/snapshots/snapshot-table";
import { userFacingApiMessage } from "@/lib/api/errors";
import { listSnapshots } from "@/lib/api/snapshots";
import { DEFAULT_PAGE_LIMIT } from "@/lib/api/paging";
import type { SnapshotInfo } from "@/lib/api/types";

type SnapshotsSearchParams = {
  name?: string;
  sandboxID?: string;
  nextToken?: string;
};

export const metadata = {
  title: "Snapshots · AgentENV",
};

export default async function SnapshotsPage({
  searchParams,
}: {
  searchParams: Promise<SnapshotsSearchParams>;
}) {
  const params = await searchParams;
  const name = params.name?.trim() ?? "";
  const sandboxID = params.sandboxID?.trim() ?? "";
  const nextToken = params.nextToken?.trim() || undefined;

  let snapshots: SnapshotInfo[] = [];
  let followingToken: string | undefined;
  let error: string | null = null;

  try {
    const page = await listSnapshots({
      name: name || undefined,
      sandboxID: sandboxID || undefined,
      nextToken,
      limit: DEFAULT_PAGE_LIMIT,
    });
    snapshots = page.items;
    followingToken = page.nextToken;
  } catch (caught) {
    error = userFacingApiMessage(caught);
  }

  const filtered = name !== "" || sandboxID !== "";
  const nextPageQuery = new URLSearchParams();
  if (name) {
    nextPageQuery.set("name", name);
  }
  if (sandboxID) {
    nextPageQuery.set("sandboxID", sandboxID);
  }
  const firstPageHref = nextPageQuery.toString()
    ? `/snapshots?${nextPageQuery.toString()}`
    : "/snapshots";
  if (followingToken) {
    nextPageQuery.set("nextToken", followingToken);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Snapshots</h1>
        <p className="text-sm text-muted-foreground">
          Paused sandbox images captured through the snapshot API. Use one as
          the starting point for a new sandbox.
        </p>
      </div>

      <Card size="sm">
        <CardContent>
          <SnapshotFilters initial={{ name, sandboxID }} />
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load snapshots</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : snapshots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CameraIcon className="size-5 text-muted-foreground" />
            <p className="font-medium">
              {filtered ? "No matching snapshots" : "No snapshots yet"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {filtered
                ? "No snapshot matches the current filters on this page."
                : "Snapshots appear here once a running sandbox is captured through the snapshot API."}
            </p>
            {filtered ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/snapshots" />}
              >
                <RotateCcwIcon />
                Clear filters
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-0">
          <SnapshotTable snapshots={snapshots} sourceSandboxID={sandboxID} />
        </Card>
      )}

      {(nextToken || followingToken) && !error ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {snapshots.length} snapshot
            {snapshots.length === 1 ? "" : "s"}
            {nextToken ? " on a following page" : ""}.
          </span>
          <div className="flex gap-2">
            {nextToken ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={firstPageHref} />}
              >
                First page
              </Button>
            ) : null}
            {followingToken ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/snapshots?${nextPageQuery.toString()}`} />}
              >
                Next page
                <ChevronRightIcon />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
