import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getConnectionSessionSummary } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — AgentENV",
};

export default async function DashboardPage() {
  const session = await getConnectionSessionSummary();

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Cluster overview panels land in a follow-up PR. Connection settings
          are available now.
        </p>
      </div>
      <p className="text-sm">
        {session
          ? `Connected to ${session.gatewayUrl}.`
          : "Not connected yet."}
      </p>
      <Button nativeButton={false} render={<Link href="/settings" />}>
        Open Settings
      </Button>
    </div>
  );
}
