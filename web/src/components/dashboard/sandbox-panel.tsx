import type { ReactNode } from "react";
import Link from "next/link";
import { BoxIcon, ClockIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
import { cn } from "@/lib/utils";
import type { LoadResult } from "@/lib/api/dashboard";
import { summarizeSandboxes } from "@/lib/api/dashboard";
import type { SandboxInfo } from "@/lib/api/types";
import {
  formatCount,
  formatMegabytes,
  truncateId,
} from "@/components/dashboard/format";
import { LocalTime, RelativeTime } from "@/components/local-time";
import {
  EmptyState,
  PanelNotice,
  StatTile,
} from "@/components/dashboard/primitives";

/** `/v2/sandboxes` is paged; the dashboard only reads the first page. */
const PAGE_LIMIT = 100;

function templateLabelOf(sandbox: SandboxInfo): string {
  if (typeof sandbox.alias === "string" && sandbox.alias) {
    return sandbox.alias;
  }
  return sandbox.templateID ?? "—";
}

function SandboxStateBadge({ state }: { state?: string }) {
  const normalized = (state ?? "").toLowerCase();
  const className =
    normalized === "running"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
      : normalized === "paused"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-500"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <Badge variant="outline" className={cn(className, "capitalize")}>
      {normalized || "unknown"}
    </Badge>
  );
}

export function SandboxPanel({
  sandboxes,
}: {
  sandboxes: LoadResult<SandboxInfo[]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BoxIcon className="size-4 text-muted-foreground" />
          Sandboxes
        </CardTitle>
        <CardDescription>
          Running and paused sandboxes reported by the Gateway.
        </CardDescription>
        <CardAction>
          <Button
            size="xs"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/sandboxes" />}
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!sandboxes.ok ? (
          <PanelNotice result={sandboxes} resourceLabel="sandboxes" />
        ) : (
          <SandboxTiles sandboxes={sandboxes.data} />
        )}
      </CardContent>
    </Card>
  );
}

function SandboxTiles({ sandboxes }: { sandboxes: SandboxInfo[] }) {
  const summary = summarizeSandboxes(sandboxes);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Running"
          value={formatCount(summary.running)}
          tone={summary.running > 0 ? "positive" : "neutral"}
        />
        <StatTile label="Paused" value={formatCount(summary.paused)} />
        <StatTile
          label="vCPU reserved"
          value={formatCount(summary.cpuAllocated)}
        />
        <StatTile
          label="Memory reserved"
          value={formatMegabytes(summary.memoryAllocatedMB)}
        />
      </div>
      {summary.total >= PAGE_LIMIT ? (
        <p className="text-xs text-muted-foreground">
          Showing the first {PAGE_LIMIT} sandboxes — totals may be higher.
        </p>
      ) : null}
    </div>
  );
}

function SandboxTable({
  sandboxes,
  timeColumn,
  timeValue,
  emptyMessage,
}: {
  sandboxes: SandboxInfo[];
  timeColumn: string;
  timeValue: (sandbox: SandboxInfo) => string | undefined;
  emptyMessage: ReactNode;
}) {
  if (sandboxes.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[27%]">Sandbox</TableHead>
          <TableHead className="w-[25%]">Template</TableHead>
          <TableHead className="w-[23%]">State</TableHead>
          <TableHead className="w-[25%] text-right">{timeColumn}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sandboxes.map((sandbox) => (
          <TableRow key={sandbox.sandboxID}>
            <TableCell
              className="truncate font-mono text-xs"
              title={sandbox.sandboxID}
            >
              {truncateId(sandbox.sandboxID, 10)}
            </TableCell>
            <TableCell
              className="truncate text-xs text-muted-foreground"
              title={templateLabelOf(sandbox)}
            >
              {templateLabelOf(sandbox)}
            </TableCell>
            <TableCell>
              <SandboxStateBadge state={sandbox.state} />
            </TableCell>
            <TableCell className="text-right text-xs">
              <div className="flex flex-col items-end">
                <RelativeTime value={timeValue(sandbox)} />
                <LocalTime
                  value={timeValue(sandbox)}
                  dateStyle="short"
                  timeStyle={undefined}
                  className="text-muted-foreground"
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SandboxActivityPanels({
  sandboxes,
}: {
  sandboxes: LoadResult<SandboxInfo[]>;
}) {
  const summary = sandboxes.ok
    ? summarizeSandboxes(sandboxes.data)
    : { recent: [], expiringSoon: [] };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            Recently created
          </CardTitle>
          <CardDescription>The five newest sandbox starts.</CardDescription>
        </CardHeader>
        <CardContent>
          {!sandboxes.ok ? (
            <PanelNotice result={sandboxes} resourceLabel="recent sandboxes" />
          ) : (
            <SandboxTable
              sandboxes={summary.recent}
              timeColumn="Started"
              timeValue={(sandbox) => sandbox.startedAt}
              emptyMessage="No sandboxes have been created yet."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="size-4 text-muted-foreground" />
            Expiring soon
          </CardTitle>
          <CardDescription>
            Sandboxes closest to their auto-eviction deadline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sandboxes.ok ? (
            <PanelNotice result={sandboxes} resourceLabel="sandbox expiry" />
          ) : (
            <SandboxTable
              sandboxes={summary.expiringSoon}
              timeColumn="Expires"
              timeValue={(sandbox) => sandbox.endAt}
              emptyMessage="No sandboxes have an upcoming expiry."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
