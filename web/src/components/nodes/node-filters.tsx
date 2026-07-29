"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { NodeStatusCounts } from "@/lib/api/nodes";
import {
  DISPLAY_NODE_STATUSES,
  nodeStatusLabel,
  type DisplayNodeStatus,
} from "@/components/nodes/node-status-badge";

export type NodeStatusFilter = DisplayNodeStatus | "all";

const SEARCH_DEBOUNCE_MS = 250;

export function NodeFilters({
  query,
  status,
  counts,
}: {
  query: string;
  status: NodeStatusFilter;
  counts: NodeStatusCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState(query);
  const [appliedQuery, setAppliedQuery] = useState(query);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (query !== appliedQuery) {
    setAppliedQuery(query);
    setDraft(query);
  }

  useEffect(
    () => () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
      }
    },
    [],
  );

  const apply = (next: { query?: string; status?: NodeStatusFilter }) => {
    const params = new URLSearchParams();
    const nextQuery = next.query ?? query;
    const nextStatus = next.status ?? status;
    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }
    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }
    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  };

  const onSearchChange = (value: string) => {
    setDraft(value);
    if (debounce.current) {
      clearTimeout(debounce.current);
    }
    debounce.current = setTimeout(
      () => apply({ query: value }),
      SEARCH_DEBOUNCE_MS,
    );
  };

  const chips: Array<{
    value: NodeStatusFilter;
    label: string;
    count: number;
  }> = [
    { value: "all", label: "All", count: counts.total },
    ...DISPLAY_NODE_STATUSES.map((value) => ({
      value,
      label: nodeStatusLabel(value),
      count: counts[value],
    })),
  ];
  if (counts.unknown > 0) {
    chips.push({
      value: "unknown",
      label: nodeStatusLabel("unknown"),
      count: counts.unknown,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter by node, cluster, version…"
          className="h-8 w-64 pl-8"
          aria-label="Filter nodes"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => apply({ status: chip.value })}
            aria-pressed={chip.value === status}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
              chip.value === status
                ? "border-foreground/20 bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50",
            )}
          >
            {chip.label}
            <span className="tabular-nums opacity-70">{chip.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
