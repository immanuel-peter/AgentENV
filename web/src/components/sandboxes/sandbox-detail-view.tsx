"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { patchCustomExtensionParamsAction } from "@/app/(console)/sandboxes/actions";
import { CopyButton } from "@/components/sandboxes/copy-button";
import {
  ExpiryBadge,
  SandboxStateBadge,
} from "@/components/sandboxes/sandbox-badges";
import { SandboxActions } from "@/components/sandboxes/sandbox-actions";
import {
  formatCpu,
  formatMemoryMB,
  formatRelative,
  formatTimestamp,
  parseJsonObject,
} from "@/components/sandboxes/format";
import { useNow } from "@/components/sandboxes/use-now";
import type { CustomExtensionParams, SandboxDetail } from "@/lib/api/sandboxes";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

function Mono({ value }: { value?: string | null }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs break-all">{value}</span>
      <CopyButton value={value} label="value" />
    </span>
  );
}

function SecretRow({ label, value }: { label: string; value?: string | null }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <DetailRow label={label}>
      {value ? (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-xs break-all">
            {revealed ? value : "•".repeat(Math.min(value.length, 24))}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
          <CopyButton value={value} label={label} />
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </DetailRow>
  );
}

function BoolBadge({ value }: { value?: boolean | null }) {
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground">not set</span>;
  }
  return (
    <Badge variant={value ? "secondary" : "outline"}>
      {value ? "enabled" : "disabled"}
    </Badge>
  );
}

function RuleList({ rules }: { rules?: string[] }) {
  if (!rules || rules.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {rules.map((rule) => (
        <Badge key={rule} variant="outline" className="font-mono text-[11px]">
          {rule}
        </Badge>
      ))}
    </span>
  );
}

function ExtensionParamsCard({
  sandboxID,
  initialParams,
  loadError,
  canPatch,
}: {
  sandboxID: string;
  initialParams: CustomExtensionParams | null;
  loadError?: string;
  canPatch: boolean;
}) {
  const router = useRouter();
  const [params, setParams] = useState(initialParams);
  const [open, setOpen] = useState(false);
  const [patchText, setPatchText] = useState("{}");
  const [pending, setPending] = useState(false);

  function submitPatch() {
    const parsed = parseJsonObject(patchText);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    if (pending) {
      return;
    }

    setPending(true);
    void (async () => {
      try {
        const result = await patchCustomExtensionParamsAction(
          sandboxID,
          parsed.value,
        );
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setParams(result.data);
        setOpen(false);
        toast.success("Custom extension params updated.");
        router.refresh();
      } finally {
        setPending(false);
      }
    })();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom extension params</CardTitle>
        <CardDescription>
          Opaque JSON interpreted only by the configured custom extension.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadError ? (
          <p className="text-sm text-muted-foreground">{loadError}</p>
        ) : (
          <pre className="max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
            {JSON.stringify(params ?? {}, null, 2)}
          </pre>
        )}
        {canPatch && !loadError ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <PencilIcon />
            Patch params
          </Button>
        ) : null}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Patch custom extension params</DialogTitle>
              <DialogDescription>
                The document is passed to the extension verbatim; the extension
                decides how to merge it and returns the full updated params.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="extension-patch">Patch document (JSON)</Label>
              <Textarea
                id="extension-patch"
                value={patchText}
                onChange={(event) => setPatchText(event.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={submitPatch} disabled={pending}>
                {pending ? "Applying…" : "Apply patch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export type SandboxDetailViewProps = {
  sandbox: SandboxDetail;
  extensionParams: CustomExtensionParams | null;
  extensionError?: string;
  fetchedAt: string;
};

export function SandboxDetailView({
  sandbox,
  extensionParams,
  extensionError,
  fetchedAt,
}: SandboxDetailViewProps) {
  const now = useNow();
  const metadataEntries = Object.entries(sandbox.metadata ?? {});
  const expired =
    now !== null && sandbox.endAt
      ? new Date(sandbox.endAt).getTime() <= now
      : false;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight break-all">
                {sandbox.sandboxID}
              </h1>
              <CopyButton
                value={sandbox.sandboxID}
                label="sandbox ID"
                size="icon-sm"
              />
              <SandboxStateBadge state={sandbox.state} />
            </div>
            <p className="text-sm text-muted-foreground">
              {sandbox.alias ? `${sandbox.alias} · ` : ""}
              {sandbox.templateID} · loaded{" "}
              {now === null ? "just now" : formatRelative(fetchedAt, now)}
            </p>
          </div>
          <SandboxActions sandbox={sandbox} />
        </div>
      </div>

      {expired ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Past its expiration</AlertTitle>
          <AlertDescription>
            This sandbox reached its end time. Depending on its timeout policy
            it may already be paused or killed — refresh to re-read state.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity and source</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Sandbox ID">
              <Mono value={sandbox.sandboxID} />
            </DetailRow>
            <DetailRow label="Template / snapshot">
              <Mono value={sandbox.templateID} />
            </DetailRow>
            <DetailRow label="Alias">
              {sandbox.alias ? (
                <span className="font-mono text-xs">{sandbox.alias}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="envd version">
              {sandbox.envdVersion ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Client ID">
              {sandbox.clientID ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="vCPU">{formatCpu(sandbox.cpuCount)}</DetailRow>
            <DetailRow label="Memory">
              {formatMemoryMB(sandbox.memoryMB)}
            </DetailRow>
            <DetailRow label="Disk">
              {formatMemoryMB(sandbox.diskSizeMB)}
            </DetailRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lifecycle</CardTitle>
            <CardDescription>
              Timeout policy and the current expiration window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailRow label="State">
              <SandboxStateBadge state={sandbox.state} />
            </DetailRow>
            <DetailRow label="On timeout">
              {sandbox.lifecycle?.onTimeout ? (
                <Badge variant="outline" className="capitalize">
                  {sandbox.lifecycle.onTimeout}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label="Auto-resume">
              <BoolBadge value={sandbox.lifecycle?.autoResume} />
            </DetailRow>
            <DetailRow label="Started">
              <span title={formatTimestamp(sandbox.startedAt)}>
                {formatTimestamp(sandbox.startedAt)}
              </span>
            </DetailRow>
            <DetailRow label="Expires">
              <span
                className="inline-flex items-center gap-2"
                title={formatTimestamp(sandbox.endAt)}
              >
                {formatTimestamp(sandbox.endAt)}
                <ExpiryBadge endAt={sandbox.endAt} now={now} />
              </span>
            </DetailRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Network</CardTitle>
            <CardDescription>
              Egress policy currently applied to the sandbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailRow label="Internet access">
              <BoolBadge value={sandbox.allowInternetAccess} />
            </DetailRow>
            <DetailRow label="Public traffic">
              <BoolBadge value={sandbox.network?.allowPublicTraffic} />
            </DetailRow>
            <DetailRow label="Allowed egress">
              <RuleList rules={sandbox.network?.allowOut} />
            </DetailRow>
            <DetailRow label="Denied egress">
              <RuleList rules={sandbox.network?.denyOut} />
            </DetailRow>
            <DetailRow label="Mask request host">
              {sandbox.network?.maskRequestHost ? (
                <span className="font-mono text-xs">
                  {sandbox.network.maskRequestHost}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>
              Proxy domain and tokens are hidden until you reveal them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SecretRow label="Proxy domain" value={sandbox.domain} />
            <SecretRow label="envd access token" value={sandbox.envdAccessToken} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>
              {metadataEntries.length} key
              {metadataEntries.length === 1 ? "" : "s"} attached at creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metadataEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No metadata.</p>
            ) : (
              metadataEntries.map(([key, value]) => (
                <DetailRow key={key} label={key}>
                  <span className="font-mono text-xs break-all">{value}</span>
                </DetailRow>
              ))
            )}
          </CardContent>
        </Card>

        <ExtensionParamsCard
          sandboxID={sandbox.sandboxID}
          initialParams={extensionParams}
          loadError={extensionError}
          canPatch={sandbox.state === "running"}
        />
      </div>
    </div>
  );
}
