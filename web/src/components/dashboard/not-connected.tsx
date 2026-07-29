import Link from "next/link";
import { PlugZapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function NotConnected({
  title = "Not connected to a Gateway",
  description = "Configure the Gateway URL and API key in Settings to load cluster health, node inventory, and sandbox activity.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZapIcon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button nativeButton={false} render={<Link href="/settings" />}>
          Open Settings
        </Button>
        <span className="text-xs text-muted-foreground">
          An admin token is optional, but required for node and capacity data.
        </span>
      </CardContent>
    </Card>
  );
}
