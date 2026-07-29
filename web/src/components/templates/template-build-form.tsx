"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  HammerIcon,
  InfoIcon,
  SearchCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeStep,
  StepEditor,
  stepIssue,
  stepToRequest,
  type StepRow,
} from "@/components/templates/step-editor";
import {
  createAndBuildTemplateAction,
  resolveTemplateAliasAction,
  type BuildSubmission,
} from "@/app/(console)/templates/actions";
import { parseTags } from "@/lib/api/templates";

type BaseKind = "image" | "template";

export type BuildFormDefaults = {
  name?: string;
  tags?: string;
  cpuCount?: string;
  memoryMB?: string;
  baseKind?: BaseKind;
  fromImage?: string;
  fromTemplate?: string;
  /** Set when the form was opened from an existing template's Rebuild action. */
  rebuildFrom?: string;
};

function positiveInteger(raw: string): number | undefined {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export function TemplateBuildForm({
  defaults = {},
}: {
  defaults?: BuildFormDefaults;
}) {
  const router = useRouter();
  const [submitting, startSubmit] = useTransition();
  const [checkingAlias, startAliasCheck] = useTransition();

  const [reviewing, setReviewing] = useState(false);
  const [name, setName] = useState(defaults.name ?? "");
  const [tags, setTags] = useState(defaults.tags ?? "");
  const [cpuCount, setCpuCount] = useState(defaults.cpuCount ?? "2");
  const [memoryMB, setMemoryMB] = useState(defaults.memoryMB ?? "1024");
  const [baseKind, setBaseKind] = useState<BaseKind>(
    defaults.baseKind ?? (defaults.fromTemplate ? "template" : "image"),
  );
  const [fromImage, setFromImage] = useState(defaults.fromImage ?? "");
  const [fromTemplate, setFromTemplate] = useState(defaults.fromTemplate ?? "");
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [startCmd, setStartCmd] = useState("");
  const [readyCmd, setReadyCmd] = useState("");
  const [force, setForce] = useState(false);

  const trimmedName = name.trim();
  const cpu = positiveInteger(cpuCount);
  const memory = positiveInteger(memoryMB);

  const problems: string[] = [];
  if (!trimmedName) {
    problems.push("A template name is required.");
  } else if (trimmedName.length > 128) {
    problems.push("The template name must be 128 characters or fewer.");
  }
  if (cpu === undefined) {
    problems.push("CPU count must be a whole number of at least 1.");
  }
  if (memory === undefined || memory < 128) {
    problems.push("Memory must be a whole number of at least 128 MiB.");
  }
  if (baseKind === "image" && !fromImage.trim()) {
    problems.push("Provide the base OCI image reference.");
  }
  if (baseKind === "template" && !fromTemplate.trim()) {
    problems.push("Provide the base template name or ID.");
  }
  for (const [index, step] of steps.entries()) {
    const issue = stepIssue(step);
    if (issue) {
      problems.push(`Step ${index + 1}: ${issue}`);
    }
  }

  const submission: BuildSubmission = {
    template: {
      name: trimmedName,
      tags: parseTags(tags),
      cpuCount: cpu,
      memoryMB: memory,
    },
    build: {
      ...(baseKind === "image"
        ? { fromImage: fromImage.trim() }
        : { fromTemplate: fromTemplate.trim() }),
      force,
      steps: steps.map(stepToRequest),
      ...(startCmd.trim() ? { startCmd: startCmd.trim() } : {}),
      ...(readyCmd.trim() ? { readyCmd: readyCmd.trim() } : {}),
    },
  };

  function checkAlias() {
    const alias = fromTemplate.trim();
    if (!alias) {
      return;
    }
    startAliasCheck(async () => {
      const result = await resolveTemplateAliasAction(alias);
      if (result.ok) {
        toast.success(`Resolved to template ${result.data.templateID}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function submit() {
    startSubmit(async () => {
      const result = await createAndBuildTemplateAction(submission);
      if (!result.ok) {
        toast.error(result.error);
        setReviewing(false);
        return;
      }
      toast.success("Build queued.");
      router.push(
        `/templates/${encodeURIComponent(result.data.templateID)}?build=${encodeURIComponent(result.data.buildID)}`,
      );
    });
  }

  if (reviewing) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Review the build</CardTitle>
            <CardDescription>
              Creating the template and starting the build are two API calls.
              The build itself then runs in the background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="label-micro text-muted-foreground">
                  Name
                </dt>
                <dd className="text-sm">{trimmedName}</dd>
              </div>
              <div>
                <dt className="label-micro text-muted-foreground">
                  Resources
                </dt>
                <dd className="text-sm">
                  {cpu} vCPU · {memory} MiB
                </dd>
              </div>
              <div>
                <dt className="label-micro text-muted-foreground">
                  Base
                </dt>
                <dd className="font-mono text-xs">
                  {baseKind === "image"
                    ? fromImage.trim()
                    : fromTemplate.trim()}
                </dd>
              </div>
            </dl>

            <div>
              <p className="mb-1 label-micro text-muted-foreground">
                Steps
              </p>
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None — the base image is published as-is.
                </p>
              ) : (
                <ol className="space-y-1">
                  {steps.map((step, index) => (
                    <li key={step.id} className="font-mono text-xs">
                      <span className="mr-2 text-muted-foreground">
                        {index + 1}.
                      </span>
                      {describeStep(step)}
                      {step.force ? (
                        <span className="ml-2 text-amber-300">(forced)</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">
                <code>{`POST /v3/templates\n${JSON.stringify(submission.template, null, 2)}`}</code>
              </pre>
              <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">
                <code>{`POST /v2/templates/{id}/builds/{id}\n${JSON.stringify(submission.build, null, 2)}`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => setReviewing(false)}
          >
            <ArrowLeftIcon />
            Back to edit
          </Button>
          <Button disabled={submitting} onClick={submit}>
            <HammerIcon />
            {submitting ? "Starting build…" : "Create and build"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {defaults.rebuildFrom ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Rebuilding from an existing template</AlertTitle>
          <AlertDescription>
            The API does not return a template&apos;s original build steps, so
            re-enter any steps you need. The rebuild is published as a new
            template with its own ID; the original stays untouched. Base is
            prefilled with{" "}
            <Link
              href={`/templates/${encodeURIComponent(defaults.rebuildFrom)}`}
              className="font-mono text-xs"
            >
              {defaults.rebuildFrom}
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identity and resources</CardTitle>
          <CardDescription>
            A tag can be appended to the name with a colon, for example
            <code className="mx-1 font-mono text-xs">my-template:v1</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              placeholder="my-template"
              maxLength={128}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-tags">Tags</Label>
            <Input
              id="template-tags"
              value={tags}
              placeholder="v1, stable"
              onChange={(event) => setTags(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma separated.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-cpu">CPU count</Label>
            <Input
              id="template-cpu"
              type="number"
              min={1}
              value={cpuCount}
              onChange={(event) => setCpuCount(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-memory">Memory (MiB)</Label>
            <Input
              id="template-memory"
              type="number"
              min={128}
              step={128}
              value={memoryMB}
              onChange={(event) => setMemoryMB(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base</CardTitle>
          <CardDescription>
            Start from an OCI image or layer on top of an existing template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={baseKind === "image" ? "secondary" : "ghost"}
              onClick={() => setBaseKind("image")}
            >
              OCI image
            </Button>
            <Button
              type="button"
              size="sm"
              variant={baseKind === "template" ? "secondary" : "ghost"}
              onClick={() => setBaseKind("template")}
            >
              Existing template
            </Button>
          </div>

          {baseKind === "image" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="from-image">Image reference</Label>
              <Input
                id="from-image"
                value={fromImage}
                placeholder="ghcr.io/org/base:latest"
                className="font-mono text-xs"
                onChange={(event) => setFromImage(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Private registries need a{" "}
                <code className="font-mono">docker login</code> on the node
                before the build starts.
              </p>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="from-template">Template name or ID</Label>
              <div className="flex gap-2">
                <Input
                  id="from-template"
                  value={fromTemplate}
                  placeholder="my-base-template"
                  className="max-w-sm font-mono text-xs"
                  onChange={(event) => setFromTemplate(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={checkingAlias || !fromTemplate.trim()}
                  onClick={checkAlias}
                >
                  <SearchCheckIcon />
                  Resolve
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Steps</CardTitle>
          <CardDescription>
            Applied in order on top of the base, the same way image layers
            stack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StepEditor steps={steps} onChange={setSteps} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime commands</CardTitle>
          <CardDescription>
            Optional commands the sandbox runs after the template boots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="start-cmd">Start command</Label>
              <Input
                id="start-cmd"
                value={startCmd}
                placeholder="/usr/local/bin/serve"
                className="font-mono text-xs"
                onChange={(event) => setStartCmd(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ready-cmd">Ready check</Label>
              <Input
                id="ready-cmd"
                value={readyCmd}
                placeholder="curl -sf localhost:8000/health"
                className="font-mono text-xs"
                onChange={(event) => setReadyCmd(event.target.value)}
              />
            </div>
          </div>

          <Label className="w-fit font-normal">
            <Checkbox
              checked={force}
              onCheckedChange={(checked) => setForce(checked === true)}
            />
            Force the whole build, ignoring cached layers
          </Label>
        </CardContent>
      </Card>

      {problems.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Fix these before building</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" nativeButton={false} render={<Link href="/templates" />}>
          Cancel
        </Button>
        <Button
          disabled={problems.length > 0}
          onClick={() => setReviewing(true)}
        >
          <CheckIcon />
          Review
        </Button>
      </div>
    </div>
  );
}
