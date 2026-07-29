import Link from "next/link";
import { ChevronRightIcon, LayersIcon, PlusIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateTable } from "@/components/templates/template-table";
import { userFacingApiMessage } from "@/lib/api/errors";
import { MAX_PAGE_LIMIT } from "@/lib/api/paging";
import { listTemplates } from "@/lib/api/templates-server";
import type { ListedTemplate } from "@/lib/api/templates";

type TemplatesSearchParams = {
  nextToken?: string;
};

export const metadata = {
  title: "Templates · AgentENV",
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<TemplatesSearchParams>;
}) {
  const params = await searchParams;
  const nextToken = params.nextToken?.trim() || undefined;

  let templates: ListedTemplate[] = [];
  let followingToken: string | undefined;
  let error: string | null = null;

  try {
    const page = await listTemplates({ nextToken, limit: MAX_PAGE_LIMIT });
    templates = page.items;
    followingToken = page.nextToken;
  } catch (caught) {
    error = userFacingApiMessage(caught);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Declaratively built base images that sandboxes start from.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/templates/new" />}>
          <PlusIcon />
          Build template
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load templates</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <LayersIcon className="size-5 text-muted-foreground" />
            <p className="font-medium">No templates yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Build one from an OCI image or an existing template to give
              sandboxes a pre-warmed environment.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/templates/new" />}
            >
              <PlusIcon />
              Build template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TemplateTable templates={templates} />
      )}

      {(nextToken || followingToken) && !error ? (
        <div className="flex items-center justify-end gap-2">
          {nextToken ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/templates" />}
            >
              First page
            </Button>
          ) : null}
          {followingToken ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  href={`/templates?nextToken=${encodeURIComponent(followingToken)}`}
                />
              }
            >
              Next page
              <ChevronRightIcon />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
