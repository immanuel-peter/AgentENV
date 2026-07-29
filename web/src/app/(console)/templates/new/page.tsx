import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TemplateBuildForm,
  type BuildFormDefaults,
} from "@/components/templates/template-build-form";

type NewTemplateSearchParams = {
  name?: string;
  tags?: string;
  cpuCount?: string;
  memoryMB?: string;
  fromImage?: string;
  fromTemplate?: string;
  rebuildFrom?: string;
};

export const metadata = {
  title: "Build template · AgentENV",
};

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<NewTemplateSearchParams>;
}) {
  const params = await searchParams;

  const defaults: BuildFormDefaults = {
    name: params.name,
    tags: params.tags,
    cpuCount: params.cpuCount,
    memoryMB: params.memoryMB,
    fromImage: params.fromImage,
    fromTemplate: params.fromTemplate,
    rebuildFrom: params.rebuildFrom,
    baseKind: params.fromTemplate ? "template" : "image",
  };

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        nativeButton={false}
        render={<Link href="/templates" />}
      >
        <ArrowLeftIcon />
        Templates
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Build a template
        </h1>
        <p className="text-sm text-muted-foreground">
          Describe the environment once; sandboxes then start from the published
          snapshot instead of rebuilding it.
        </p>
      </div>

      <TemplateBuildForm defaults={defaults} />
    </div>
  );
}
