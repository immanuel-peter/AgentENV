import Link from "next/link";
import { ArrowLeftIcon, InfoIcon, PlayIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/sandboxes/copy-button";
import { userFacingApiMessage } from "@/lib/api/errors";
import {
  getSnapshot,
  snapshotAliases,
  snapshotId,
  snapshotSourceSandboxId,
} from "@/lib/api/snapshots";
import { formatCpu, formatMiB } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import type { SnapshotInfo } from "@/lib/api/types";

type SnapshotDetailParams = { snapshotId: string };
type SnapshotDetailSearch = { sandboxID?: string };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="label-micro text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function SnapshotDetailPage({
  params,
  searchParams,
}: {
  params: Promise<SnapshotDetailParams>;
  searchParams: Promise<SnapshotDetailSearch>;
}) {
  const { snapshotId: requestedId } = await params;
  const { sandboxID: filterContext } = await searchParams;

  let snapshot: SnapshotInfo | null = null;
  let error: string | null = null;

  try {
    snapshot = await getSnapshot(requestedId);
  } catch (caught) {
    error = userFacingApiMessage(caught);
  }

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          nativeButton={false}
          render={<Link href="/snapshots" />}
        >
          <ArrowLeftIcon />
          Snapshots
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Could not load snapshot</AlertTitle>
          <AlertDescription>
            {error ?? "The Gateway returned no snapshot for this identifier."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const id = snapshotId(snapshot) || requestedId;
  const aliases = snapshotAliases(snapshot);
  const title = aliases[0] ?? id;
  const reportedSource = snapshotSourceSandboxId(snapshot);
  const sourceSandbox = reportedSource ?? filterContext?.trim();

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        nativeButton={false}
        render={<Link href="/snapshots" />}
      >
        <ArrowLeftIcon />
        Snapshots
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{id}</span>
            <CopyButton value={id} label="snapshot ID" />
          </div>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link
              href={`/sandboxes/new?fromSnapshot=${encodeURIComponent(id)}`}
            />
          }
        >
          <PlayIcon />
          Create sandbox
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              The snapshot ID is stable; aliases are optional labels assigned at
              capture time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3">
              <Field label="Snapshot ID">
                <span className="font-mono text-xs">{id}</span>
              </Field>
              <Field label="Aliases">
                {aliases.length === 0 ? (
                  <span className="text-muted-foreground">
                    No alias was assigned.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {aliases.map((alias) => (
                      <Badge key={alias} variant="secondary">
                        {alias}
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>
              Sandboxes restored from this snapshot inherit these resources.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="vCPU">{formatCpu(snapshot.cpuCount)}</Field>
              <Field label="Memory">{formatMiB(snapshot.memoryMB)}</Field>
              <Field label="Disk">{formatMiB(snapshot.diskSizeMB)}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Created">
                <LocalTime value={snapshot.createdAt} />
              </Field>
              <Field label="Updated">
                <LocalTime value={snapshot.updatedAt} />
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
            <CardDescription>
              Which sandbox this snapshot was captured from.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sourceSandbox ? (
              <dl className="grid gap-3">
                <Field label="Source sandbox">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/sandboxes/${encodeURIComponent(sourceSandbox)}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {sourceSandbox}
                    </Link>
                    <CopyButton value={sourceSandbox} label="sandbox ID" />
                  </div>
                </Field>
                {reportedSource ? null : (
                  <p className="text-xs text-muted-foreground">
                    Carried over from the sandbox filter you browsed with, not
                    from the snapshot payload.
                  </p>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                The snapshot payload does not carry a source sandbox. Filter the
                list by a sandbox ID to see the snapshots it produced.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Alert>
        <InfoIcon />
        <AlertTitle>Snapshots cannot be deleted from the console</AlertTitle>
        <AlertDescription>
          The control-plane API exposes no delete endpoint for snapshots, so
          they are read-only here.
        </AlertDescription>
      </Alert>
    </div>
  );
}
