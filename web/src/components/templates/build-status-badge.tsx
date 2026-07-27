import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleHelpIcon,
  LoaderIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buildStatus } from "@/lib/api/templates";
import { cn } from "@/lib/utils";

export function BuildStatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const value = buildStatus(status);

  switch (value) {
    case "ready":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
            className,
          )}
        >
          <CheckCircle2Icon />
          Ready
        </Badge>
      );
    case "building":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-sky-500/30 bg-sky-500/10 text-sky-300",
            className,
          )}
        >
          <LoaderIcon className="animate-spin" />
          Building
        </Badge>
      );
    case "waiting":
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-amber-500/30 bg-amber-500/10 text-amber-300",
            className,
          )}
        >
          <CircleDashedIcon />
          Waiting
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className={className}>
          <TriangleAlertIcon />
          Failed
        </Badge>
      );
    case "unknown":
      return (
        <Badge variant="secondary" className={className}>
          <CircleHelpIcon />
          {status?.trim() ? status : "Unknown"}
        </Badge>
      );
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}
