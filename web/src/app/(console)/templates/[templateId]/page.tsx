import Link from "next/link";
import { ArrowLeftIcon, ScrollTextIcon } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BuildLogViewer } from "@/components/templates/build-log-viewer";
import { BuildStatusBadge } from "@/components/templates/build-status-badge";
import { TemplateActions } from "@/components/templates/template-actions";
import { CopyButton } from "@/components/sandboxes/copy-button";
import { userFacingApiMessage } from "@/lib/api/errors";
import { getTemplate } from "@/lib/api/templates-server";
import {
  latestBuild,
  sortBuildsByRecency,
  templateNames,
  type TemplateWithBuilds,
} from "@/lib/api/templates";
import {
  formatCpu,
  formatMiB,
  formatNumber,
  formatTimestamp,
} from "@/lib/format";

type TemplateDetailParams = { templateId: string };
type TemplateDetailSearch = { build?: string };

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

export default async function TemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<TemplateDetailParams>;
  searchParams: Promise<TemplateDetailSearch>;
}) {
  const { templateId: requestedId } = await params;
  const { build: requestedBuild } = await searchParams;

  let template: TemplateWithBuilds | null = null;
  let error: string | null = null;

  try {
    template = await getTemplate(requestedId);
  } catch (caught) {
    error = userFacingApiMessage(caught);
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          nativeButton={false}
          render={<Link href="/templates" />}
        >
          <ArrowLeftIcon />
          Templates
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Could not load template</AlertTitle>
          <AlertDescription>
            {error ?? "The Gateway returned no template for this identifier."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const templateID = template.templateID || requestedId;
  const names = templateNames(template);
  const title = names[0] ?? templateID;
  const builds = sortBuildsByRecency(template.builds ?? []);
  const newest = latestBuild(template);
  const selectedBuildID = requestedBuild?.trim() || newest?.buildID;
  const selectedBuild = builds.find(
    (build) => build.buildID === selectedBuildID,
  );

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        nativeButton={false}
        render={<Link href="/templates" />}
      >
        <ArrowLeftIcon />
        Templates
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <BuildStatusBadge status={newest?.status} />
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{templateID}</span>
            <CopyButton value={templateID} label="template ID" />
          </div>
        </div>
        <TemplateActions
          templateID={templateID}
          label={title}
          rebuildDefaults={{
            name: names[0],
            cpuCount: newest?.cpuCount,
            memoryMB: newest?.memoryMB,
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3">
              <Field label="Aliases">
                {names.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {names.map((name) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Visibility">
                {template.public ? "Public" : "Team only"}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>
              Reported per build; these come from the most recent one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="vCPU">{formatCpu(newest?.cpuCount)}</Field>
              <Field label="Memory">{formatMiB(newest?.memoryMB)}</Field>
              <Field label="Disk">{formatMiB(newest?.diskSizeMB)}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Builds">{formatNumber(builds.length)}</Field>
              <Field label="Spawns">{formatNumber(template.spawnCount)}</Field>
              <Field label="Last spawned">
                {formatTimestamp(template.lastSpawnedAt)}
              </Field>
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
                {formatTimestamp(template.createdAt)}
              </Field>
              <Field label="Updated">
                {formatTimestamp(template.updatedAt)}
              </Field>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="pt-0">
        <CardHeader className="pt-(--card-spacing)">
          <CardTitle>Build history</CardTitle>
          <CardDescription>
            AgentENV publishes one build per template, so a rebuild produces a
            new template rather than another row here.
          </CardDescription>
        </CardHeader>
        {builds.length === 0 ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No builds reported for this template.
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Build</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>envd</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Finished</TableHead>
                <TableHead className="text-right">Logs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {builds.map((build) => (
                <TableRow
                  key={build.buildID}
                  data-state={
                    build.buildID === selectedBuildID ? "selected" : undefined
                  }
                >
                  <TableCell className="font-mono text-xs">
                    {build.buildID}
                  </TableCell>
                  <TableCell>
                    <BuildStatusBadge status={build.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCpu(build.cpuCount)} · {formatMiB(build.memoryMB)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {build.envdVersion ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(build.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(build.finishedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`/templates/${encodeURIComponent(templateID)}?build=${encodeURIComponent(build.buildID)}`}
                        />
                      }
                    >
                      <ScrollTextIcon />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {selectedBuildID ? (
        <BuildLogViewer
          key={selectedBuildID}
          templateID={templateID}
          buildID={selectedBuildID}
          initialStatus={selectedBuild?.status ?? newest?.status}
        />
      ) : null}
    </div>
  );
}
