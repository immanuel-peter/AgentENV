"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuildStatusBadge } from "@/components/templates/build-status-badge";
import {
  fetchBuildStatusAction,
  revalidateTemplateAction,
} from "@/app/(console)/templates/actions";
import {
  isBuildInFlight,
  logLevel,
  type BuildLogEntry,
  type TemplateBuildInfo,
} from "@/lib/api/templates";
import { LocalTime } from "@/components/local-time";

const POLL_INTERVAL_MS = 3_000;

function levelClass(level?: string | null): string {
  const value = logLevel(level);
  switch (value) {
    case "error":
      return "text-destructive";
    case "warn":
      return "text-amber-300";
    case "debug":
      return "text-muted-foreground";
    case "info":
      return "text-sky-300";
    case "unknown":
      return "text-muted-foreground";
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

function LogLines({ entries }: { entries: BuildLogEntry[] }) {
  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
      {entries.map((entry, index) => (
        <div key={`${entry.timestamp ?? index}-${index}`} className="flex gap-2">
          <LocalTime
            value={entry.timestamp}
            dateStyle={undefined}
            timeStyle="medium"
            className="shrink-0 text-muted-foreground"
          />
          <span className={`w-12 shrink-0 uppercase ${levelClass(entry.level)}`}>
            {entry.level ?? ""}
          </span>
          {entry.step ? (
            <span className="shrink-0 text-muted-foreground">
              [{entry.step}]
            </span>
          ) : null}
          <span className="whitespace-pre-wrap">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Builds run in the background after `POST /v2/templates/{id}/builds/{id}`
 * returns, so an in-flight build is polled until it settles and the
 * server-rendered detail around it is then revalidated.
 */
export function BuildLogViewer({
  templateID,
  buildID,
  initialStatus,
}: {
  templateID: string;
  buildID: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<TemplateBuildInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const wasInFlight = useRef(isBuildInFlight(initialStatus));

  const status = info?.status ?? initialStatus;
  const live = isBuildInFlight(status) && error === null;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const result = await fetchBuildStatusAction(templateID, buildID);
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setError(null);
      setInfo(result.data);

      if (isBuildInFlight(result.data.status)) {
        wasInFlight.current = true;
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      if (wasInFlight.current) {
        wasInFlight.current = false;
        await revalidateTemplateAction(templateID);
        router.refresh();
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [templateID, buildID, reloadKey, router]);

  const refresh = useCallback(() => {
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  const logEntries = info?.logEntries ?? [];
  const logs = info?.logs ?? [];
  const reason = info?.reason;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Build
          <span className="font-mono text-xs text-muted-foreground">
            {buildID}
          </span>
          <BuildStatusBadge status={status} />
          {live ? (
            <Badge variant="secondary">Auto-refreshing every 3s</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Logs are streamed by the Gateway; a build that reports none simply did
          not publish any.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not read the build status</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {reason ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>
              Build failed{reason.step ? ` at ${reason.step}` : ""}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{reason.message}</p>
              {reason.logEntries?.length ? (
                <LogLines entries={reason.logEntries} />
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="structured">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="structured">
                Structured ({logEntries.length})
              </TabsTrigger>
              <TabsTrigger value="raw">Raw ({logs.length})</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCwIcon />
              Refresh
            </Button>
          </div>

          <TabsContent value="structured">
            {logEntries.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No structured log entries reported for this build.
              </p>
            ) : (
              <LogLines entries={logEntries} />
            )}
          </TabsContent>

          <TabsContent value="raw">
            {logs.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No plain log lines reported for this build.
              </p>
            ) : (
              <pre className="max-h-[28rem] overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
                <code>{logs.join("\n")}</code>
              </pre>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
