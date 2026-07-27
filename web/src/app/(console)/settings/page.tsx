import { ConnectionForm } from "@/components/settings/connection-form";
import { getConnectionSessionSummary } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — AgentENV",
};

export default async function SettingsPage() {
  const session = await getConnectionSessionSummary();

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Point the console at an AgentENV Gateway and store the credentials it
          should use for this browser session.
        </p>
      </div>
      <ConnectionForm initialSession={session} />
    </div>
  );
}
