"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, LayersIcon, PlayIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BuildStatusBadge } from "@/components/templates/build-status-badge";
import { CopyButton } from "@/components/sandboxes/copy-button";
import {
  buildStatus,
  templateNames,
  type ListedTemplate,
} from "@/lib/api/templates";
import {
  formatCpu,
  formatMiB,
  formatNumber,
  formatTimestamp,
} from "@/lib/format";

const STATUS_FILTERS: Record<string, string> = {
  all: "All statuses",
  ready: "Ready",
  building: "Building",
  waiting: "Waiting",
  error: "Failed",
};

const SORT_OPTIONS: Record<string, string> = {
  updated: "Recently updated",
  created: "Recently created",
  name: "Name",
  spawns: "Most spawned",
};

function timeValue(value?: string | null): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * `GET /v2/templates` takes no filter parameters, so search and status live in
 * component state and narrow the page that was already fetched.
 */
export function TemplateTable({ templates }: { templates: ListedTemplate[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const matched = templates.filter((template) => {
      if (status !== "all" && buildStatus(template.buildStatus) !== status) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [template.templateID, ...templateNames(template)];
      return haystack.some((value) => value.toLowerCase().includes(needle));
    });

    return matched.sort((a, b) => {
      switch (sort) {
        case "created":
          return timeValue(b.createdAt) - timeValue(a.createdAt);
        case "name":
          return (templateNames(a)[0] ?? a.templateID).localeCompare(
            templateNames(b)[0] ?? b.templateID,
          );
        case "spawns":
          return (b.spawnCount ?? 0) - (a.spawnCount ?? 0);
        default:
          return timeValue(b.updatedAt) - timeValue(a.updatedAt);
      }
    });
  }, [templates, search, status, sort]);

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label
              htmlFor="template-search"
              className="text-xs text-muted-foreground"
            >
              Search this page
            </Label>
            <div className="relative">
              <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <Input
                id="template-search"
                value={search}
                placeholder="Template name or ID"
                className="w-72 pl-8"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Build status</Label>
            <Select
              items={STATUS_FILTERS}
              value={status}
              onValueChange={(value) => setStatus(value ?? "all")}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_FILTERS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Sort by</Label>
            <Select
              items={SORT_OPTIONS}
              value={sort}
              onValueChange={(value) => setSort(value ?? "updated")}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="ml-auto text-sm text-muted-foreground">
            {visible.length} of {templates.length} shown
          </span>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <LayersIcon className="size-5 text-muted-foreground" />
            <p className="font-medium">No matching templates</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Nothing on this page matches the current search and status filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead className="text-right">Builds</TableHead>
                <TableHead className="text-right">Spawns</TableHead>
                <TableHead>Last spawned</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((template) => {
                const names = templateNames(template);
                const href = `/templates/${encodeURIComponent(template.templateID)}`;
                return (
                  <TableRow key={template.templateID}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        <Link
                          href={href}
                          className="font-mono text-xs hover:underline"
                        >
                          {template.templateID}
                        </Link>
                        <CopyButton
                          value={template.templateID}
                          label="template ID"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <BuildStatusBadge status={template.buildStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCpu(template.cpuCount)} ·{" "}
                      {formatMiB(template.memoryMB)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(template.buildCount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatNumber(template.spawnCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(template.lastSpawnedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(template.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={
                            <Link
                              href={`/sandboxes/new?fromTemplate=${encodeURIComponent(template.templateID)}`}
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
                          render={<Link href={href} />}
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
        </Card>
      )}
    </div>
  );
}
