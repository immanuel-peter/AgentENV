"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CopyButton } from "@/components/sandboxes/copy-button";
import {
  ExpiryBadge,
  MetadataChips,
  SandboxSourceLink,
  SandboxStateBadge,
} from "@/components/sandboxes/sandbox-badges";
import {
  formatCpu,
  formatMemoryMB,
  formatRelative,
  shortId,
} from "@/components/sandboxes/format";
import { useNow } from "@/components/sandboxes/use-now";
import type { ListedSandbox } from "@/lib/api/sandboxes";

export type SandboxStateFilter = "all" | "running" | "paused";

const STATE_LABELS: Record<SandboxStateFilter, string> = {
  all: "All states",
  running: "Running",
  paused: "Paused",
};

const SORT_OPTIONS = {
  "started-desc": "Newest first",
  "started-asc": "Oldest first",
  "expires-asc": "Expiring soonest",
  "cpu-desc": "Most vCPU",
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

const LIMIT_OPTIONS = ["25", "50", "100", "200"] as const;

export type SandboxListProps = {
  sandboxes: ListedSandbox[];
  state: SandboxStateFilter;
  metadataQuery: string;
  limit: number;
  hasMore: boolean;
  fetchedAt: string;
  error?: string;
};

function timeValue(iso?: string): number {
  if (!iso) {
    return 0;
  }
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function matchesQuery(sandbox: ListedSandbox, query: string): boolean {
  const haystack = [
    sandbox.sandboxID,
    sandbox.templateID,
    sandbox.alias,
    sandbox.state,
    ...Object.entries(sandbox.metadata ?? {}).map(
      ([key, value]) => `${key}=${value}`,
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function SandboxList({
  sandboxes,
  state,
  metadataQuery,
  limit,
  hasMore,
  fetchedAt,
  error,
}: SandboxListProps) {
  const router = useRouter();
  const now = useNow();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("started-desc");
  const [metadataDraft, setMetadataDraft] = useState(metadataQuery);

  function applyParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      state: state === "all" ? undefined : state,
      metadata: metadataQuery || undefined,
      limit: limit === 50 ? undefined : String(limit),
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) {
        params.set(key, value);
      }
    }
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `/sandboxes?${search}` : "/sandboxes");
    });
  }

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? sandboxes.filter((sandbox) => matchesQuery(sandbox, normalizedQuery))
      : sandboxes;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "started-asc":
          return timeValue(a.startedAt) - timeValue(b.startedAt);
        case "expires-asc":
          return timeValue(a.endAt) - timeValue(b.endAt);
        case "cpu-desc":
          return (b.cpuCount ?? 0) - (a.cpuCount ?? 0);
        case "started-desc":
          return timeValue(b.startedAt) - timeValue(a.startedAt);
        default: {
          const exhaustive: never = sort;
          return exhaustive;
        }
      }
    });
  }, [sandboxes, query, sort]);

  const counts = useMemo(() => {
    let running = 0;
    let paused = 0;
    for (const sandbox of sandboxes) {
      if (sandbox.state === "running") {
        running += 1;
      } else if (sandbox.state === "paused") {
        paused += 1;
      }
    }
    return { running, paused, total: sandboxes.length };
  }, [sandboxes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sandboxes</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total} sandbox{counts.total === 1 ? "" : "es"} · {counts.running}{" "}
            running · {counts.paused} paused · updated{" "}
            {now === null ? "just now" : formatRelative(fetchedAt, now)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
            Refresh
          </Button>
          <Button nativeButton={false} render={<Link href="/sandboxes/new" />}>
            <PlusIcon />
            Create sandbox
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load sandboxes</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="sandbox-search">Search</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sandbox-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ID, template, alias, metadata…"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>State</Label>
          <Select
            value={state}
            onValueChange={(value) => {
              if (value) {
                applyParams({ state: value === "all" ? undefined : value });
              }
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue>{(value) => STATE_LABELS[value as SandboxStateFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Sort</Label>
          <Select
            value={sort}
            onValueChange={(value) => {
              if (value) {
                setSort(value);
              }
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue>{(value) => SORT_OPTIONS[value as SortKey]}</SelectValue>
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

        <div className="space-y-1.5">
          <Label>Page size</Label>
          <Select
            value={String(limit)}
            onValueChange={(value) => {
              if (value) {
                applyParams({ limit: value });
              }
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue>{(value) => String(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyParams({ metadata: metadataDraft.trim() || undefined });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="sandbox-metadata-filter">Metadata filter</Label>
            <Input
              id="sandbox-metadata-filter"
              value={metadataDraft}
              onChange={(event) => setMetadataDraft(event.target.value)}
              placeholder="user=abc&app=prod"
              className="w-56 font-mono text-xs"
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Apply
          </Button>
          {metadataQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear metadata filter"
              onClick={() => {
                setMetadataDraft("");
                applyParams({ metadata: undefined });
              }}
            >
              <XIcon />
            </Button>
          ) : null}
        </form>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sandbox</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Resources</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {sandboxes.length === 0
                      ? "No sandboxes match the current filters."
                      : "No sandboxes match your search."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((sandbox) => (
                <TableRow key={sandbox.sandboxID}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/sandboxes/${encodeURIComponent(sandbox.sandboxID)}`}
                        className="font-mono text-xs hover:underline"
                        title={sandbox.sandboxID}
                      >
                        {shortId(sandbox.sandboxID, 14, 6)}
                      </Link>
                      <CopyButton value={sandbox.sandboxID} label="sandbox ID" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <SandboxStateBadge state={sandbox.state} />
                  </TableCell>
                  <TableCell>
                    <SandboxSourceLink
                      templateID={sandbox.templateID}
                      alias={sandbox.alias}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatCpu(sandbox.cpuCount)} · {formatMemoryMB(sandbox.memoryMB)}
                    {sandbox.diskSizeMB
                      ? ` · ${formatMemoryMB(sandbox.diskSizeMB)} disk`
                      : ""}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground"
                    title={sandbox.startedAt}
                  >
                    {now === null ? "…" : formatRelative(sandbox.startedAt, now)}
                  </TableCell>
                  <TableCell
                    className="text-xs"
                    title={sandbox.endAt}
                  >
                    <ExpiryBadge endAt={sandbox.endAt} now={now} />
                  </TableCell>
                  <TableCell>
                    <MetadataChips metadata={sandbox.metadata} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Open sandbox ${sandbox.sandboxID}`}
                      nativeButton={false}
                      render={
                        <Link
                          href={`/sandboxes/${encodeURIComponent(sandbox.sandboxID)}`}
                        />
                      }
                    >
                      <ArrowRightIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">More results available</Badge>
          Showing the first {limit}. Increase the page size or narrow the filters.
        </div>
      ) : null}
    </div>
  );
}
