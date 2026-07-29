import Link from "next/link";
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { userFacingApiMessage } from "@/lib/api/errors";
import {
  getCustomExtensionParams,
  getSandbox,
  type CustomExtensionParams,
  type SandboxDetail,
} from "@/lib/api/sandboxes";
import { SandboxDetailView } from "@/components/sandboxes/sandbox-detail-view";

export default async function SandboxDetailPage({
  params,
}: {
  params: Promise<{ sandboxId: string }>;
}) {
  const { sandboxId } = await params;

  let sandbox: SandboxDetail;
  try {
    sandbox = await getSandbox(sandboxId);
  } catch (error) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
          nativeButton={false}
          render={<Link href="/sandboxes" />}
        >
          <ArrowLeftIcon />
          Sandboxes
        </Button>
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load sandbox</AlertTitle>
          <AlertDescription>
            <p className="font-mono text-xs">{sandboxId}</p>
            <p>{userFacingApiMessage(error)}</p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  let extensionParams: CustomExtensionParams | null = null;
  let extensionError: string | undefined;
  try {
    extensionParams = await getCustomExtensionParams(sandboxId);
  } catch (error) {
    extensionError = userFacingApiMessage(error);
  }

  return (
    <SandboxDetailView
      sandbox={sandbox}
      extensionParams={extensionParams}
      extensionError={extensionError}
      fetchedAt={new Date().toISOString()}
    />
  );
}
