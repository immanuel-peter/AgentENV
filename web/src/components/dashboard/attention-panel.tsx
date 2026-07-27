import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LoadResult } from "@/lib/api/dashboard";
import { summarizeTemplates, templateLabel } from "@/lib/api/dashboard";
import { nodePressure, nodeStatus, type ClusterNode } from "@/lib/api/nodes";
import type { TemplateInfo } from "@/lib/api/types";
import { truncateId } from "@/components/dashboard/format";
import {
  NodeStatusBadge,
  PressureBadge,
} from "@/components/nodes/node-status-badge";

type Problem = {
  key: string;
  title: ReactNode;
  detail: string;
  badge: ReactNode;
};

const PRESSURE_RANK = { critical: 0, warn: 1, ok: 2 } as const;

function nodeProblems(nodes: LoadResult<ClusterNode[]>): Problem[] {
  if (!nodes.ok) {
    return [];
  }

  return nodes.data
    .map((node) => ({ node, pressure: nodePressure(node) }))
    .filter(({ pressure }) => pressure.level !== "ok")
    .sort(
      (a, b) =>
        PRESSURE_RANK[a.pressure.level] - PRESSURE_RANK[b.pressure.level],
    )
    .slice(0, 6)
    .map(({ node, pressure }) => ({
      key: `node:${node.id}`,
      title: (
        <Link
          href={`/nodes/${encodeURIComponent(node.id)}`}
          className="font-mono text-xs underline-offset-4 hover:underline"
          title={node.id}
        >
          {truncateId(node.id, 18)}
        </Link>
      ),
      detail: pressure.reasons.join(" · "),
      badge:
        pressure.level === "critical" ? (
          <NodeStatusBadge status={nodeStatus(node)} />
        ) : (
          <PressureBadge level={pressure.level} />
        ),
    }));
}

function templateProblems(templates: LoadResult<TemplateInfo[]>): Problem[] {
  if (!templates.ok) {
    return [];
  }

  return summarizeTemplates(templates.data)
    .failed.slice(0, 6)
    .map((template) => ({
      key: `template:${template.templateID ?? templateLabel(template)}`,
      title: <span className="text-xs">{templateLabel(template)}</span>,
      detail: "Last build failed",
      badge: (
        <Badge
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-500"
        >
          Build error
        </Badge>
      ),
    }));
}

/** Aggregates the things an operator should look at first. */
export function AttentionPanel({
  nodes,
  templates,
}: {
  nodes: LoadResult<ClusterNode[]>;
  templates: LoadResult<TemplateInfo[]>;
}) {
  const problems = [...nodeProblems(nodes), ...templateProblems(templates)];
  const unavailable = !nodes.ok || !templates.ok;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlertIcon className="size-4 text-muted-foreground" />
          Needs attention
        </CardTitle>
        <CardDescription>
          Unhealthy or saturated nodes and failed template builds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {problems.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4 text-emerald-400" />
            Nothing needs attention right now.
          </div>
        ) : (
          <ul className="space-y-2">
            {problems.map((problem) => (
              <li
                key={problem.key}
                className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 ring-1 ring-foreground/5"
              >
                <div className="min-w-0 space-y-0.5">
                  {problem.title}
                  <p className="text-xs text-muted-foreground">
                    {problem.detail}
                  </p>
                </div>
                {problem.badge}
              </li>
            ))}
          </ul>
        )}
        {unavailable ? (
          <p className="text-xs text-muted-foreground">
            {!nodes.ok ? "Node checks unavailable. " : ""}
            {!templates.ok ? "Template build checks unavailable." : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
