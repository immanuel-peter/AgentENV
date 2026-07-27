"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_STEP_TYPES,
  type TemplateStep,
  type TemplateStepType,
} from "@/lib/api/templates";

export type StepRow = {
  id: string;
  type: TemplateStepType;
  /** RUN: `[command]`. ENV: `[key, value]`. WORKDIR: `[path]`. */
  values: string[];
  force: boolean;
};

let nextStepId = 0;

export function createStep(type: TemplateStepType = "RUN"): StepRow {
  nextStepId += 1;
  return {
    id: `step-${nextStepId}`,
    type,
    values: type === "ENV" ? ["", ""] : [""],
    force: false,
  };
}

/** ENV keeps its (possibly empty) value, which the other step types do not have. */
export function stepToRequest(step: StepRow): TemplateStep {
  const args =
    step.type === "ENV"
      ? [step.values[0]?.trim() ?? "", step.values[1] ?? ""]
      : [step.values[0]?.trim() ?? ""];

  return { type: step.type, args, force: step.force };
}

export function describeStep(step: StepRow): string {
  switch (step.type) {
    case "RUN":
      return `RUN ${step.values[0] ?? ""}`.trim();
    case "ENV":
      return `ENV ${step.values[0] ?? ""}=${step.values[1] ?? ""}`.trim();
    case "WORKDIR":
      return `WORKDIR ${step.values[0] ?? ""}`.trim();
    default: {
      const exhaustive: never = step.type;
      return exhaustive;
    }
  }
}

/** Mirrors the server-side step validation so the review pane can block early. */
export function stepIssue(step: StepRow): string | null {
  switch (step.type) {
    case "RUN":
      return step.values[0]?.trim() ? null : "RUN needs a command.";
    case "ENV":
      return step.values[0]?.trim() ? null : "ENV needs a variable name.";
    case "WORKDIR":
      return step.values[0]?.trim() ? null : "WORKDIR needs a path.";
    default: {
      const exhaustive: never = step.type;
      return exhaustive;
    }
  }
}

export function StepEditor({
  steps,
  onChange,
  disabled,
}: {
  steps: StepRow[];
  onChange: (steps: StepRow[]) => void;
  disabled?: boolean;
}) {
  function update(id: string, patch: Partial<StepRow>) {
    onChange(
      steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= steps.length) {
      return;
    }
    const reordered = [...steps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    onChange(reordered);
  }

  return (
    <div className="space-y-3">
      {steps.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No steps. The template will be the base image as-is.
        </p>
      ) : null}

      {steps.map((step, index) => {
        const issue = stepIssue(step);
        return (
          <div
            key={step.id}
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[7rem_1fr_auto]"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Step {index + 1}
              </Label>
              <div className="flex gap-1">
                {TEMPLATE_STEP_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="xs"
                    variant={step.type === type ? "secondary" : "ghost"}
                    disabled={disabled}
                    onClick={() =>
                      update(step.id, {
                        type,
                        values: type === "ENV" ? ["", ""] : [""],
                      })
                    }
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {step.type === "RUN" ? (
                <Textarea
                  value={step.values[0] ?? ""}
                  placeholder="apt-get update && apt-get install -y curl"
                  disabled={disabled}
                  className="font-mono text-xs"
                  onChange={(event) =>
                    update(step.id, { values: [event.target.value] })
                  }
                />
              ) : null}

              {step.type === "ENV" ? (
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={step.values[0] ?? ""}
                    placeholder="VARIABLE"
                    disabled={disabled}
                    className="w-48 font-mono text-xs"
                    onChange={(event) =>
                      update(step.id, {
                        values: [event.target.value, step.values[1] ?? ""],
                      })
                    }
                  />
                  <Input
                    value={step.values[1] ?? ""}
                    placeholder="value"
                    disabled={disabled}
                    className="w-64 font-mono text-xs"
                    onChange={(event) =>
                      update(step.id, {
                        values: [step.values[0] ?? "", event.target.value],
                      })
                    }
                  />
                </div>
              ) : null}

              {step.type === "WORKDIR" ? (
                <Input
                  value={step.values[0] ?? ""}
                  placeholder="/workspace"
                  disabled={disabled}
                  className="w-64 font-mono text-xs"
                  onChange={(event) =>
                    update(step.id, { values: [event.target.value] })
                  }
                />
              ) : null}

              <Label className="w-fit text-xs font-normal text-muted-foreground">
                <Checkbox
                  checked={step.force}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    update(step.id, { force: checked === true })
                  }
                />
                Rebuild this step even when it is cached
              </Label>

              {issue ? (
                <p className="text-xs text-destructive">{issue}</p>
              ) : null}
            </div>

            <div className="flex items-start gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move step up"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Move step down"
                disabled={disabled || index === steps.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove step"
                disabled={disabled}
                onClick={() =>
                  onChange(steps.filter((candidate) => candidate.id !== step.id))
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...steps, createStep()])}
      >
        <PlusIcon />
        Add step
      </Button>
    </div>
  );
}
