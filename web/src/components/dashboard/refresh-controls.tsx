"use client";

import { useCallback, useEffect, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LocalTime } from "@/components/dashboard/local-time";

const AUTO_REFRESH_MS = 15_000;

/**
 * `localStorage` is an external store, so the preference is read through
 * `useSyncExternalStore` instead of an effect. Writes notify local subscribers
 * because the `storage` event only fires in other tabs.
 */
const toggleListeners = new Set<() => void>();

function subscribeToToggle(onChange: () => void) {
  toggleListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    toggleListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useAutoRefreshPreference(
  storageKey: string,
): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribeToToggle,
    () => window.localStorage.getItem(storageKey) === "on",
    () => false,
  );

  const setEnabled = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(storageKey, next ? "on" : "off");
      for (const listener of toggleListeners) {
        listener();
      }
    },
    [storageKey],
  );

  return [enabled, setEnabled];
}

/**
 * Manual refresh plus an opt-in 15s auto refresh. Both re-run the server
 * components for the current route, so every panel refetches from the Gateway.
 */
export function RefreshControls({
  fetchedAt,
  storageKey,
  className,
}: {
  fetchedAt: string;
  storageKey: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoRefresh, setAutoRefresh] = useAutoRefreshPreference(storageKey);
  const switchId = `${storageKey}-auto-refresh`;

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = setInterval(() => {
      startTransition(() => router.refresh());
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, router]);

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <span className="text-xs text-muted-foreground">
        Updated <LocalTime value={fetchedAt} dateStyle="short" />
      </span>
      <div className="flex items-center gap-2">
        <Switch
          id={switchId}
          size="sm"
          checked={autoRefresh}
          onCheckedChange={setAutoRefresh}
        />
        <Label htmlFor={switchId} className="text-xs text-muted-foreground">
          Auto {AUTO_REFRESH_MS / 1000}s
        </Label>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCwIcon className={cn(pending && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}
