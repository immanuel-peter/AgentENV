import Link from "next/link";
import { ArrowUpRightIcon, PlayIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/sandboxes/copy-button";
import { snapshotAliases, snapshotId } from "@/lib/api/snapshots";
import { formatCpu, formatMiB } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import type { SnapshotInfo } from "@/lib/api/types";

export function SnapshotTable({
  snapshots,
  sourceSandboxID,
}: {
  snapshots: SnapshotInfo[];
  /** Carried into detail links so provenance survives a filtered browse. */
  sourceSandboxID?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Snapshot</TableHead>
          <TableHead>Aliases</TableHead>
          <TableHead>Resources</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {snapshots.map((snapshot) => {
          const id = snapshotId(snapshot);
          const aliases = snapshotAliases(snapshot);
          const detailHref = sourceSandboxID
            ? `/snapshots/${encodeURIComponent(id)}?sandboxID=${encodeURIComponent(sourceSandboxID)}`
            : `/snapshots/${encodeURIComponent(id)}`;

          return (
            <TableRow key={id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1">
                  <Link
                    href={detailHref}
                    className="font-mono text-xs hover:underline"
                  >
                    {id}
                  </Link>
                  <CopyButton value={id} label="snapshot ID" />
                </div>
              </TableCell>
              <TableCell>
                {aliases.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {aliases.map((alias) => (
                      <Badge key={alias} variant="secondary">
                        {alias}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatCpu(snapshot.cpuCount)} · {formatMiB(snapshot.memoryMB)}
                {typeof snapshot.diskSizeMB === "number"
                  ? ` · ${formatMiB(snapshot.diskSizeMB)} disk`
                  : ""}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <LocalTime
                  value={snapshot.createdAt}
                  dateStyle="short"
                  timeStyle="short"
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                <LocalTime
                  value={snapshot.updatedAt}
                  dateStyle="short"
                  timeStyle="short"
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
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
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={detailHref} />}
                  >
                    Details
                    <ArrowUpRightIcon />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
