"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ClockIcon,
  HardDriveIcon,
  PlusIcon,
  RocketIcon,
  TrashIcon,
  TriangleAlertIcon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createColdSandboxAction,
  createSandboxAction,
} from "@/app/(console)/sandboxes/actions";
import {
  parseCommaSeparated,
  parseJsonObject,
  parseKeyValueLines,
} from "@/components/sandboxes/format";
import type {
  AttachedDriveInput,
  NewColdSandboxRequest,
  NewSandboxRequest,
  SandboxNetworkConfig,
} from "@/lib/api/sandboxes";

export type CreateMode = "template" | "cold";
export type SourceKind = "template" | "snapshot";

type InternetAccess = "default" | "allow" | "block";
type OnTimeout = "pause" | "kill";

const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  template: "Template",
  snapshot: "Snapshot",
};

const ON_TIMEOUT_LABELS: Record<OnTimeout, string> = {
  pause: "Pause (resumable)",
  kill: "Kill (discard)",
};

const INTERNET_LABELS: Record<InternetAccess, string> = {
  default: "Server default",
  allow: "Allow internet",
  block: "Block internet",
};

type DriveDraft = {
  key: string;
  driveID: string;
  image: string;
  mountPath: string;
  subPath: string;
  readOnly: boolean;
  diskSizeMB: string;
};

type Errors = Record<string, string>;

function newDrive(): DriveDraft {
  return {
    key: Math.random().toString(36).slice(2),
    driveID: "",
    image: "",
    mountPath: "",
    subPath: "",
    readOnly: true,
    diskSizeMB: "",
  };
}

type NumberField = { value?: number; error?: string };

function parseNumber(
  raw: string,
  options: { min?: number; required?: boolean; label: string },
): NumberField {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return options.required
      ? { error: `${options.label} is required.` }
      : {};
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    return { error: `${options.label} must be a whole number.` };
  }
  if (options.min !== undefined && value < options.min) {
    return { error: `${options.label} must be at least ${options.min}.` };
  }
  return { value };
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-2.5">
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

export type CreateSandboxFormProps = {
  initialMode: CreateMode;
  initialSourceKind: SourceKind;
  initialSourceId: string;
  initialImage: string;
};

export function CreateSandboxForm({
  initialMode,
  initialSourceKind,
  initialSourceId,
  initialImage,
}: CreateSandboxFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [mode, setMode] = useState<CreateMode>(initialMode);

  const [sourceKind, setSourceKind] = useState<SourceKind>(initialSourceKind);
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [secure, setSecure] = useState(false);

  const [image, setImage] = useState(initialImage);
  const [cpuCount, setCpuCount] = useState("2");
  const [memoryMB, setMemoryMB] = useState("2048");
  const [diskSizeMB, setDiskSizeMB] = useState("");
  const [extraBootArgs, setExtraBootArgs] = useState("");
  const [drives, setDrives] = useState<DriveDraft[]>([]);

  const [timeoutSeconds, setTimeoutSeconds] = useState("300");
  const [onTimeout, setOnTimeout] = useState<OnTimeout>("pause");
  const [autoResume, setAutoResume] = useState(false);

  const [envVarsText, setEnvVarsText] = useState("");
  const [metadataText, setMetadataText] = useState("");
  const [customParamsText, setCustomParamsText] = useState("");

  const [internetAccess, setInternetAccess] = useState<InternetAccess>("default");
  const [allowPublicTraffic, setAllowPublicTraffic] = useState(true);
  const [allowOutText, setAllowOutText] = useState("");
  const [denyOutText, setDenyOutText] = useState("");
  const [maskRequestHost, setMaskRequestHost] = useState("");

  const built = useMemo(() => {
    const errors: Errors = {};

    const timeout = parseNumber(timeoutSeconds, {
      min: 0,
      required: true,
      label: "Timeout",
    });
    if (timeout.error) {
      errors.timeout = timeout.error;
    }

    const envVars = parseKeyValueLines(envVarsText);
    if (!envVars.ok) {
      errors.envVars = envVars.error;
    }
    const metadata = parseKeyValueLines(metadataText);
    if (!metadata.ok) {
      errors.metadata = metadata.error;
    }
    const customParams = parseJsonObject(customParamsText);
    if (!customParams.ok) {
      errors.customParams = customParams.error;
    }

    const allowOut = parseCommaSeparated(allowOutText);
    const denyOut = parseCommaSeparated(denyOutText);
    const maskHost = maskRequestHost.trim();

    const network: SandboxNetworkConfig = {};
    if (!allowPublicTraffic) {
      network.allowPublicTraffic = false;
    }
    if (allowOut.length > 0) {
      network.allowOut = allowOut;
    }
    if (denyOut.length > 0) {
      network.denyOut = denyOut;
    }
    if (maskHost !== "") {
      network.maskRequestHost = maskHost;
    }
    const hasNetwork = Object.keys(network).length > 0;

    const shared = {
      timeout: timeout.value,
      autoPause: onTimeout === "pause",
      autoResume: autoResume ? { enabled: true } : undefined,
      network: hasNetwork ? network : undefined,
      metadata:
        metadata.ok && Object.keys(metadata.value).length > 0
          ? metadata.value
          : undefined,
      envVars:
        envVars.ok && Object.keys(envVars.value).length > 0
          ? envVars.value
          : undefined,
      customExtensionParams:
        customParams.ok && Object.keys(customParams.value).length > 0
          ? customParams.value
          : undefined,
    };

    const internet =
      internetAccess === "default" ? undefined : internetAccess === "allow";

    if (mode === "template") {
      const trimmedSource = sourceId.trim();
      if (trimmedSource === "") {
        errors.sourceId = `${SOURCE_KIND_LABELS[sourceKind]} ID or alias is required.`;
      }

      const body: NewSandboxRequest = {
        templateID: trimmedSource,
        ...shared,
        secure: secure ? true : undefined,
        allow_internet_access: internet,
      };
      return { errors, endpoint: "POST /sandboxes", body };
    }

    const trimmedImage = image.trim();
    if (trimmedImage === "") {
      errors.image = "OCI image reference is required.";
    }

    const cpu = parseNumber(cpuCount, { min: 1, label: "CPU count" });
    if (cpu.error) {
      errors.cpuCount = cpu.error;
    }
    const memory = parseNumber(memoryMB, { min: 128, label: "Memory" });
    if (memory.error) {
      errors.memoryMB = memory.error;
    }
    const disk = parseNumber(diskSizeMB, { min: 0, label: "Disk size" });
    if (disk.error) {
      errors.diskSizeMB = disk.error;
    }

    const attachedDrives: AttachedDriveInput[] = [];
    const seenDriveIds = new Set<string>();
    for (const [index, drive] of drives.entries()) {
      const driveID = drive.driveID.trim();
      const driveImage = drive.image.trim();
      if (driveID === "") {
        errors[`drive-${index}`] = "Drive ID is required.";
      } else if (driveID.includes("/")) {
        errors[`drive-${index}`] = "Drive ID must not contain '/'.";
      } else if (seenDriveIds.has(driveID)) {
        errors[`drive-${index}`] = "Drive IDs must be unique.";
      } else if (driveImage === "") {
        errors[`drive-${index}`] = "Drive image is required.";
      } else if (drive.mountPath.trim() !== "" && !drive.mountPath.trim().startsWith("/")) {
        errors[`drive-${index}`] = "Mount path must be absolute.";
      } else if (drive.subPath.trim().startsWith("/")) {
        errors[`drive-${index}`] = "Sub path must be relative.";
      }
      seenDriveIds.add(driveID);

      const driveDisk = parseNumber(drive.diskSizeMB, {
        min: 0,
        label: "Drive disk size",
      });
      if (driveDisk.error) {
        errors[`drive-${index}`] = driveDisk.error;
      }

      if (driveID !== "" && driveImage !== "") {
        attachedDrives.push({
          driveID,
          source: { image: driveImage },
          readOnly: drive.readOnly,
          mountPath: drive.mountPath.trim() || undefined,
          subPath: drive.subPath.trim() || undefined,
          diskSizeMB: driveDisk.value,
        });
      }
    }

    const body: NewColdSandboxRequest = {
      image: trimmedImage,
      ...shared,
      allowInternetAccess: internet,
      cpuCount: cpu.value,
      memoryMB: memory.value,
      diskSizeMB: disk.value,
      attachedDrives: attachedDrives.length > 0 ? attachedDrives : undefined,
      extraBootArgs: extraBootArgs.trim() || undefined,
    };
    return { errors, endpoint: "POST /sandboxes-cold", body };
  }, [
    mode,
    sourceId,
    sourceKind,
    secure,
    image,
    cpuCount,
    memoryMB,
    diskSizeMB,
    drives,
    extraBootArgs,
    timeoutSeconds,
    onTimeout,
    autoResume,
    envVarsText,
    metadataText,
    customParamsText,
    internetAccess,
    allowPublicTraffic,
    allowOutText,
    denyOutText,
    maskRequestHost,
  ]);

  const errorList = Object.values(built.errors);
  const showError = (key: string) =>
    attempted ? built.errors[key] : undefined;

  function submit() {
    setAttempted(true);
    setSubmitError(null);

    if (errorList.length > 0) {
      toast.error(
        `Resolve ${errorList.length} issue${errorList.length === 1 ? "" : "s"} before creating the sandbox.`,
      );
      return;
    }

    startTransition(async () => {
      const result =
        mode === "template"
          ? await createSandboxAction(built.body as NewSandboxRequest)
          : await createColdSandboxAction(built.body as NewColdSandboxRequest);

      if (!result.ok) {
        setSubmitError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(`Sandbox ${result.data.sandboxID} created.`);
      router.push(`/sandboxes/${encodeURIComponent(result.data.sandboxID)}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
            nativeButton={false}
            render={<Link href="/sandboxes" />}
          >
            <ArrowLeftIcon />
            Sandboxes
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create sandbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Start from an existing template or snapshot, or cold-start straight
            from an OCI image.
          </p>
        </div>
      </div>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as CreateMode)}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="template">Template / snapshot</TabsTrigger>
          <TabsTrigger value="cold">Cold start (OCI image)</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <CardDescription>
                The Gateway resolves templates and snapshots through the same
                identifier, so an ID or alias both work here.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Field label="Source kind">
                <Select
                  value={sourceKind}
                  onValueChange={(value) => {
                    if (value) {
                      setSourceKind(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value) => SOURCE_KIND_LABELS[value as SourceKind]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={`${SOURCE_KIND_LABELS[sourceKind]} ID or alias`}
                htmlFor="sandbox-source-id"
                error={showError("sourceId")}
                hint="Sent as templateID on POST /sandboxes."
              >
                <Input
                  id="sandbox-source-id"
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                  placeholder={
                    sourceKind === "snapshot" ? "my-snapshot:v1" : "base"
                  }
                  className="font-mono text-xs"
                />
              </Field>
              <div className="sm:col-span-2">
                <ToggleRow
                  label="Secure system communication"
                  hint="Requires signed access tokens for envd and proxy traffic."
                  checked={secure}
                  onCheckedChange={setSecure}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cold" className="flex flex-col gap-4">
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>Cold starts can be slow</AlertTitle>
            <AlertDescription>
              On a cache miss the node pulls and converts the OCI layers before
              boot, which can take tens of seconds. Keep this tab open until the
              request returns.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Image and resources</CardTitle>
              <CardDescription>
                Resources apply to the cold-started VM. Leave disk size empty to
                use the server default.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field
                label="OCI image"
                htmlFor="sandbox-image"
                error={showError("image")}
                hint="e.g. ghcr.io/org/image:tag"
              >
                <Input
                  id="sandbox-image"
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                  placeholder="ghcr.io/org/image:tag"
                  className="font-mono text-xs"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="vCPU"
                  htmlFor="sandbox-cpu"
                  error={showError("cpuCount")}
                >
                  <Input
                    id="sandbox-cpu"
                    inputMode="numeric"
                    value={cpuCount}
                    onChange={(event) => setCpuCount(event.target.value)}
                  />
                </Field>
                <Field
                  label="Memory (MiB)"
                  htmlFor="sandbox-memory"
                  error={showError("memoryMB")}
                >
                  <Input
                    id="sandbox-memory"
                    inputMode="numeric"
                    value={memoryMB}
                    onChange={(event) => setMemoryMB(event.target.value)}
                  />
                </Field>
                <Field
                  label="Disk (MiB)"
                  htmlFor="sandbox-disk"
                  error={showError("diskSizeMB")}
                  hint="Optional"
                >
                  <Input
                    id="sandbox-disk"
                    inputMode="numeric"
                    value={diskSizeMB}
                    onChange={(event) => setDiskSizeMB(event.target.value)}
                    placeholder="server default"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDriveIcon className="size-4" />
                Attached drives
              </CardTitle>
              <CardDescription>
                Extra block drives resolved from OCI images and mounted in the
                guest. Their state is captured if the sandbox is snapshotted.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {drives.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attached drives.
                </p>
              ) : (
                drives.map((drive, index) => (
                  <div
                    key={drive.key}
                    className="grid gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Drive {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove drive ${index + 1}`}
                        onClick={() =>
                          setDrives((current) =>
                            current.filter((item) => item.key !== drive.key),
                          )
                        }
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Drive ID">
                        <Input
                          value={drive.driveID}
                          onChange={(event) =>
                            setDrives((current) =>
                              current.map((item) =>
                                item.key === drive.key
                                  ? { ...item, driveID: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="data"
                          className="font-mono text-xs"
                        />
                      </Field>
                      <Field label="Image">
                        <Input
                          value={drive.image}
                          onChange={(event) =>
                            setDrives((current) =>
                              current.map((item) =>
                                item.key === drive.key
                                  ? { ...item, image: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="ghcr.io/org/data:latest"
                          className="font-mono text-xs"
                        />
                      </Field>
                      <Field label="Mount path" hint="Defaults to /mnt/{driveID}">
                        <Input
                          value={drive.mountPath}
                          onChange={(event) =>
                            setDrives((current) =>
                              current.map((item) =>
                                item.key === drive.key
                                  ? { ...item, mountPath: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="/mnt/data"
                          className="font-mono text-xs"
                        />
                      </Field>
                      <Field label="Sub path" hint="Optional, relative">
                        <Input
                          value={drive.subPath}
                          onChange={(event) =>
                            setDrives((current) =>
                              current.map((item) =>
                                item.key === drive.key
                                  ? { ...item, subPath: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="subdir"
                          className="font-mono text-xs"
                        />
                      </Field>
                      <Field label="Disk size (MiB)" hint="Optional">
                        <Input
                          inputMode="numeric"
                          value={drive.diskSizeMB}
                          onChange={(event) =>
                            setDrives((current) =>
                              current.map((item) =>
                                item.key === drive.key
                                  ? { ...item, diskSizeMB: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Field>
                      <ToggleRow
                        label="Read only"
                        checked={drive.readOnly}
                        onCheckedChange={(checked) =>
                          setDrives((current) =>
                            current.map((item) =>
                              item.key === drive.key
                                ? { ...item, readOnly: checked }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    {showError(`drive-${index}`) ? (
                      <p className="text-xs text-destructive">
                        {showError(`drive-${index}`)}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDrives((current) => [...current, newDrive()])}
                >
                  <PlusIcon />
                  Add drive
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced boot</CardTitle>
              <CardDescription>
                Extra kernel command-line arguments. The server applies its own
                allowlist and silently drops non-matching arguments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field label="Extra boot args" htmlFor="sandbox-boot-args">
                <Input
                  id="sandbox-boot-args"
                  value={extraBootArgs}
                  onChange={(event) => setExtraBootArgs(event.target.value)}
                  placeholder="quiet loglevel=3"
                  className="font-mono text-xs"
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="size-4" />
            Lifecycle
          </CardTitle>
          <CardDescription>
            How long the sandbox lives and what happens when the timeout fires.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Timeout (seconds)"
            htmlFor="sandbox-timeout"
            error={showError("timeout")}
          >
            <Input
              id="sandbox-timeout"
              inputMode="numeric"
              value={timeoutSeconds}
              onChange={(event) => setTimeoutSeconds(event.target.value)}
            />
          </Field>
          <Field label="On timeout">
            <Select
              value={onTimeout}
              onValueChange={(value) => {
                if (value) {
                  setOnTimeout(value);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value) => ON_TIMEOUT_LABELS[value as OnTimeout]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ON_TIMEOUT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <ToggleRow
              label="Auto-resume"
              hint="Let traffic to a paused sandbox resume it automatically."
              checked={autoResume}
              onCheckedChange={setAutoResume}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Network</CardTitle>
          <CardDescription>
            Egress rules and proxy exposure. Allow entries take precedence over
            deny entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Internet access">
              <Select
                value={internetAccess}
                onValueChange={(value) => {
                  if (value) {
                    setInternetAccess(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) => INTERNET_LABELS[value as InternetAccess]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INTERNET_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mask request host" hint="Optional">
              <Input
                value={maskRequestHost}
                onChange={(event) => setMaskRequestHost(event.target.value)}
                placeholder="example.com"
                className="font-mono text-xs"
              />
            </Field>
          </div>
          <ToggleRow
            label="Allow public traffic"
            hint="When off, sandbox URLs require authentication."
            checked={allowPublicTraffic}
            onCheckedChange={setAllowPublicTraffic}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Allow egress to"
              hint="CIDRs, IPs, or domains — one per line."
            >
              <Textarea
                value={allowOutText}
                onChange={(event) => setAllowOutText(event.target.value)}
                placeholder={"8.8.8.8/32\n*.example.com"}
                rows={3}
                className="font-mono text-xs"
              />
            </Field>
            <Field
              label="Deny egress to"
              hint="CIDRs or IPs only — domains are not supported."
            >
              <Textarea
                value={denyOutText}
                onChange={(event) => setDenyOutText(event.target.value)}
                placeholder="10.0.0.0/8"
                rows={3}
                className="font-mono text-xs"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment and metadata</CardTitle>
          <CardDescription>
            Env vars and metadata use KEY=value lines. Custom extension params
            are opaque JSON interpreted only by the configured extension.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Environment variables"
            error={showError("envVars")}
            hint="One KEY=value per line."
          >
            <Textarea
              value={envVarsText}
              onChange={(event) => setEnvVarsText(event.target.value)}
              placeholder={"NODE_ENV=production\nAPI_URL=https://api.example.com"}
              rows={4}
              className="font-mono text-xs"
            />
          </Field>
          <Field
            label="Metadata"
            error={showError("metadata")}
            hint="Used by the metadata filter on the list page."
          >
            <Textarea
              value={metadataText}
              onChange={(event) => setMetadataText(event.target.value)}
              placeholder={"user=abc\napp=prod"}
              rows={4}
              className="font-mono text-xs"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Custom extension params"
              error={showError("customParams")}
              hint="JSON object. Rejected by the server when no extension is configured."
            >
              <Textarea
                value={customParamsText}
                onChange={(event) => setCustomParamsText(event.target.value)}
                placeholder='{"tier": "gold"}'
                rows={3}
                className="font-mono text-xs"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request summary</CardTitle>
          <CardDescription>
            Exactly what the console will send to{" "}
            <span className="font-mono text-xs">{built.endpoint}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
            {JSON.stringify(built.body, null, 2)}
          </pre>
          {attempted && errorList.length > 0 ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>
                {errorList.length} issue{errorList.length === 1 ? "" : "s"} to fix
              </AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {errorList.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          {submitError ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Create failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 pb-4">
        <Button variant="outline" disabled={pending} nativeButton={false} render={<Link href="/sandboxes" />}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          <RocketIcon />
          {pending ? "Creating…" : "Create sandbox"}
        </Button>
      </div>
    </div>
  );
}
