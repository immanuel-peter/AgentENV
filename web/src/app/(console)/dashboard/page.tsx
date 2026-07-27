import type { Metadata } from "next";

import { loadDashboard } from "@/lib/api/dashboard";
import { RefreshControls } from "@/components/dashboard/refresh-controls";
import { NotConnected } from "@/components/dashboard/not-connected";
import { ConnectionPanel } from "@/components/dashboard/connection-panel";
import { ClusterPanel } from "@/components/dashboard/cluster-panel";
import { CapacityPanel } from "@/components/dashboard/capacity-panel";
import { CatalogPanel } from "@/components/dashboard/catalog-panel";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import {
  SandboxActivityPanels,
  SandboxPanel,
} from "@/components/dashboard/sandbox-panel";

export const metadata: Metadata = {
  title: "Dashboard · AgentENV",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await loadDashboard();

  if (!data.connected) {
    return (
      <div className="space-y-4">
        <PageHeading />
        <NotConnected />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading />
        <RefreshControls
          fetchedAt={data.fetchedAt}
          storageKey="aenv:dashboard:auto-refresh"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ConnectionPanel data={data} />
        <ClusterPanel nodes={data.nodes} />
        <CatalogPanel templates={data.templates} snapshots={data.snapshots} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SandboxPanel sandboxes={data.sandboxes} />
        <CapacityPanel nodes={data.nodes} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2 xl:grid-cols-2">
          <SandboxActivityPanels sandboxes={data.sandboxes} />
        </div>
        <AttentionPanel nodes={data.nodes} templates={data.templates} />
      </div>
    </div>
  );
}

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Live view of Gateway health, node capacity, and sandbox activity.
      </p>
    </div>
  );
}
