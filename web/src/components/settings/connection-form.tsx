"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  EyeOffIcon,
  Link2Icon,
  LoaderCircleIcon,
  PlugZapIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  UnplugIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ConnectionStatusBadge,
  ProbeCheckRow,
} from "@/components/settings/connection-status";
import type {
  ConnectionApiResponse,
  ConnectionProbe,
  ConnectionSessionSummary,
  ConnectionUpdateRequest,
} from "@/lib/api/connection";
import { cn } from "@/lib/utils";

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8080";

const TRANSPORT_ERROR =
  "Could not reach the console server. Is the Next.js app still running?";

type PendingAction = "check" | "save" | "disconnect";

type ApiResult = {
  ok: boolean;
  data: ConnectionApiResponse | null;
};

async function callConnectionApi(
  path: string,
  init: RequestInit,
): Promise<ApiResult> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      data: text ? (JSON.parse(text) as ConnectionApiResponse) : null,
    };
  } catch {
    return { ok: false, data: null };
  }
}

function formatCheckedAt(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? "just now"
    : parsed.toLocaleTimeString();
}

export function ConnectionForm({
  initialSession,
}: {
  initialSession: ConnectionSessionSummary;
}) {
  const router = useRouter();

  const [session, setSession] = useState(initialSession);
  const [probe, setProbe] = useState<ConnectionProbe | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState(initialSession.gatewayUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [revealApiKey, setRevealApiKey] = useState(false);
  const [revealAdminToken, setRevealAdminToken] = useState(false);
  const [removeAdminToken, setRemoveAdminToken] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveBlocked, setSaveBlocked] = useState(false);

  const busy = pending !== null;

  /** Blank secret fields mean "keep what is stored", per the route contract. */
  const buildUpdate = useCallback(
    (overrides?: Partial<ConnectionUpdateRequest>): ConnectionUpdateRequest => ({
      gatewayUrl: gatewayUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      adminToken: adminToken.trim() || undefined,
      clearAdminToken: removeAdminToken || undefined,
      ...overrides,
    }),
    [gatewayUrl, apiKey, adminToken, removeAdminToken],
  );

  const runCheck = useCallback(async (body: ConnectionUpdateRequest) => {
    setPending("check");
    setError(null);

    const { ok, data } = await callConnectionApi("/api/connection/validate", {
      method: "POST",
      body: JSON.stringify(body),
    });

    setPending(null);
    if (!data) {
      setError(TRANSPORT_ERROR);
      return;
    }

    setSession(data.session);
    setProbe(data.probe);
    if (!ok || data.error) {
      setError(data.error ?? "Connection check failed.");
    }
  }, []);

  const checkedOnMount = useRef(false);
  useEffect(() => {
    if (checkedOnMount.current || !initialSession.configured) {
      return;
    }
    checkedOnMount.current = true;
    void runCheck({});
  }, [initialSession.configured, runCheck]);

  async function save(force: boolean) {
    setPending("save");
    setError(null);

    const { ok, data } = await callConnectionApi("/api/connection", {
      method: "POST",
      body: JSON.stringify(buildUpdate(force ? { force: true } : undefined)),
    });

    setPending(null);
    if (!data) {
      setError(TRANSPORT_ERROR);
      return;
    }

    setSession(data.session);
    setProbe(data.probe);

    if (!ok) {
      setError(data.error ?? "Could not save the connection.");
      setSaveBlocked(data.probe?.status === "disconnected");
      return;
    }

    setSaveBlocked(false);
    setApiKey("");
    setAdminToken("");
    setRevealApiKey(false);
    setRevealAdminToken(false);
    setRemoveAdminToken(false);
    setGatewayUrl(data.session.gatewayUrl ?? gatewayUrl);

    toast.success("Connection saved", { description: data.probe?.summary });
    router.refresh();
  }

  async function disconnect() {
    setPending("disconnect");
    setError(null);

    const { ok, data } = await callConnectionApi("/api/connection", {
      method: "DELETE",
    });

    setPending(null);
    if (!ok || !data) {
      setError(TRANSPORT_ERROR);
      return;
    }

    // Keep the URL in the field: it is not a secret and is usually reused.
    setSession(data.session);
    setProbe(null);
    setApiKey("");
    setAdminToken("");
    setRevealApiKey(false);
    setRevealAdminToken(false);
    setRemoveAdminToken(false);
    setSaveBlocked(false);
    checkedOnMount.current = true;

    toast.success("Session cleared", {
      description: "Gateway credentials were removed from this browser.",
    });
    router.refresh();
  }

  const canCheckEntered = Boolean(
    gatewayUrl.trim() && (apiKey.trim() || session.configured),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2Icon className="size-4 text-muted-foreground" />
            Connection status
          </CardTitle>
          <CardDescription>
            {session.configured ? (
              <span className="font-mono text-xs break-all">
                {session.gatewayUrl}
              </span>
            ) : (
              "No Gateway is configured for this browser session."
            )}
          </CardDescription>
          <CardAction>
            {probe ? (
              <ConnectionStatusBadge status={probe.status} />
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                {session.configured ? "Not checked" : "Not configured"}
              </Badge>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3">
          {pending === "check" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Probing the Gateway…
            </p>
          ) : null}

          {probe ? (
            <>
              <p className="text-sm text-muted-foreground">{probe.summary}</p>
              <ul className="rounded-lg border border-border/60 px-3 py-2">
                {probe.checks.map((check) => (
                  <ProbeCheckRow key={check.id} check={check} />
                ))}
              </ul>
            </>
          ) : pending !== "check" ? (
            <p className="text-sm text-muted-foreground">
              {session.configured
                ? "Run a check to probe /health, /v2/sandboxes and /nodes."
                : "Save a Gateway URL and API key below to connect."}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="flex-wrap gap-x-3 gap-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !session.configured}
            onClick={() => void runCheck({})}
          >
            <RefreshCwIcon className={cn(pending === "check" && "animate-spin")} />
            Re-check saved session
          </Button>

          {probe ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              Checked {formatCheckedAt(probe.checkedAt)}
            </span>
          ) : null}

          {session.configured ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="ml-auto"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {pending === "disconnect" ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <UnplugIcon />
              )}
              Disconnect
            </Button>
          ) : null}
        </CardFooter>
      </Card>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Gateway credentials</CardTitle>
            <CardDescription>
              Held in httpOnly cookies for this browser session and cleared on
              disconnect. Saved secrets are never sent back to this page — only
              their last 4 characters are shown.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gateway-url">Gateway URL</Label>
              <Input
                id="gateway-url"
                name="gatewayUrl"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                placeholder={DEFAULT_GATEWAY_URL}
                value={gatewayUrl}
                onChange={(event) => setGatewayUrl(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Base URL of the AgentENV Gateway, for example{" "}
                <span className="font-mono">{DEFAULT_GATEWAY_URL}</span>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="api-key">
                API key
                <span className="font-normal text-muted-foreground">
                  X-API-Key
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="api-key"
                  name="apiKey"
                  type={revealApiKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-8 font-mono"
                  placeholder={
                    session.apiKeyMasked
                      ? `Stored — ${session.apiKeyMasked}`
                      : "Required"
                  }
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1 right-1"
                  disabled={!apiKey}
                  aria-label={revealApiKey ? "Hide API key" : "Show API key"}
                  onClick={() => setRevealApiKey((value) => !value)}
                >
                  {revealApiKey ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {session.apiKeyMasked
                  ? "Leave blank to keep the stored key."
                  : "Sent on every Gateway request."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-token">
                Admin token
                <span className="font-normal text-muted-foreground">
                  X-Admin-Token · optional
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="admin-token"
                  name="adminToken"
                  type={revealAdminToken ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-8 font-mono"
                  disabled={removeAdminToken}
                  placeholder={
                    removeAdminToken
                      ? "Will be removed on save"
                      : session.adminTokenMasked
                        ? `Stored — ${session.adminTokenMasked}`
                        : "Optional"
                  }
                  value={adminToken}
                  onChange={(event) => setAdminToken(event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1 right-1"
                  disabled={!adminToken}
                  aria-label={
                    revealAdminToken ? "Hide admin token" : "Show admin token"
                  }
                  onClick={() => setRevealAdminToken((value) => !value)}
                >
                  {revealAdminToken ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>

              {session.hasAdminToken ? (
                <Label
                  htmlFor="remove-admin-token"
                  className="text-xs font-normal text-muted-foreground"
                >
                  <Checkbox
                    id="remove-admin-token"
                    checked={removeAdminToken}
                    onCheckedChange={(checked) => {
                      setRemoveAdminToken(checked);
                      if (checked) {
                        setAdminToken("");
                        setRevealAdminToken(false);
                      }
                    }}
                  />
                  Remove the stored admin token on save
                </Label>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Required for node views (<span className="font-mono">GET
                /nodes</span>). Without it, nodes report as unavailable due to
                permissions rather than failing the connection.
              </p>
            </div>

            {error ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Connection problem</AlertTitle>
                <AlertDescription>
                  {error}
                  {saveBlocked
                    ? " Fix the settings, or use Save anyway to store them regardless."
                    : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>

          <CardFooter className="flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {pending === "save" ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <PlugZapIcon />
              )}
              Save &amp; connect
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={busy || !canCheckEntered}
              onClick={() => void runCheck(buildUpdate())}
            >
              Test connection
            </Button>

            {saveBlocked ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Save anyway
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
