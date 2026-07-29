import Link from "next/link";
import { CameraIcon, LayersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LoadResult } from "@/lib/api/dashboard";
import { summarizeTemplates } from "@/lib/api/dashboard";
import type { SnapshotInfo, TemplateInfo } from "@/lib/api/types";
import { formatCount } from "@/components/dashboard/format";
import { PanelNotice, StatTile } from "@/components/dashboard/primitives";

function TemplateTiles({ templates }: { templates: TemplateInfo[] }) {
  const summary = summarizeTemplates(templates);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <StatTile label="Templates" value={formatCount(summary.total)} />
      <StatTile
        label="Ready"
        value={formatCount(summary.ready)}
        tone={summary.ready > 0 ? "positive" : "neutral"}
      />
      <StatTile
        label="Building"
        value={formatCount(summary.building)}
        tone={summary.building > 0 ? "warning" : "neutral"}
      />
    </div>
  );
}

/** Template build health and snapshot inventory, both best-effort. */
export function CatalogPanel({
  templates,
  snapshots,
}: {
  templates: LoadResult<TemplateInfo[]>;
  snapshots: LoadResult<SnapshotInfo[]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayersIcon className="size-4 text-muted-foreground" />
          Templates &amp; snapshots
        </CardTitle>
        <CardDescription>Build state and stored images.</CardDescription>
        <CardAction>
          <Button
            size="xs"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/templates" />}
          >
            Templates
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.ok ? (
          <TemplateTiles templates={templates.data} />
        ) : (
          <PanelNotice result={templates} resourceLabel="templates" />
        )}

        {snapshots.ok ? (
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 ring-1 ring-foreground/5">
            <div className="flex items-center gap-2 text-sm">
              <CameraIcon className="size-4 text-muted-foreground" />
              Snapshots
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums">
                {formatCount(snapshots.data.length)}
              </span>
              <Button
                size="xs"
                variant="ghost"
                nativeButton={false}
                render={<Link href="/snapshots" />}
              >
                View
              </Button>
            </div>
          </div>
        ) : (
          <PanelNotice result={snapshots} resourceLabel="snapshots" />
        )}
      </CardContent>
    </Card>
  );
}
