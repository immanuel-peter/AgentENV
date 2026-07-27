import { ActivityIcon, CircleCheckIcon, CircleXIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/api/dashboard";
import { formatCount } from "@/components/dashboard/format";

export function ConnectionPanel({ data }: { data: DashboardData }) {
  const healthy = data.health.ok;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon className="size-4 text-muted-foreground" />
          Gateway
        </CardTitle>
        <CardDescription className="font-mono text-xs break-all">
          {data.gatewayUrl ?? "—"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {healthy ? (
            <CircleCheckIcon className="size-4 text-emerald-400" />
          ) : (
            <CircleXIcon className="size-4 text-destructive" />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              healthy ? "text-emerald-400" : "text-destructive",
            )}
          >
            {healthy ? "Healthy" : "Unreachable"}
          </span>
          {data.health.ok ? (
            <Badge variant="outline" className="ml-auto font-mono">
              {formatCount(data.health.data.latencyMs)} ms
            </Badge>
          ) : null}
        </div>
        {!data.health.ok ? (
          <p className="text-xs text-destructive/90">{data.health.message}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={data.adminTokenPresent ? "secondary" : "outline"}>
            {data.adminTokenPresent ? "Admin token set" : "No admin token"}
          </Badge>
          <span>
            {data.adminTokenPresent
              ? "Node and capacity panels enabled."
              : "Node and capacity panels are unavailable."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
