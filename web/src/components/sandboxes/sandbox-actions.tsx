"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CameraIcon,
  CopyPlusIcon,
  NetworkIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  TimerIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createSandboxSnapshotAction,
  forkSandboxAction,
  killSandboxAction,
  pauseSandboxAction,
  resumeSandboxAction,
  setSandboxTimeoutAction,
  updateSandboxNetworkAction,
} from "@/app/(console)/sandboxes/actions";
import { parseCommaSeparated } from "@/components/sandboxes/format";
import type { SandboxDetail, SandboxNetworkUpdate } from "@/lib/api/sandboxes";

/** The fork endpoint accepts up to 100; the console caps it to a safer batch. */
const MAX_FORKS = 16;

type InternetAccess = "unchanged" | "allow" | "block";

const INTERNET_LABELS: Record<InternetAccess, string> = {
  unchanged: "Leave unset",
  allow: "Allow internet",
  block: "Block internet",
};

function positiveInteger(raw: string): number | null {
  const value = Number(raw.trim());
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function SandboxActions({ sandbox }: { sandbox: SandboxDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const [timeoutValue, setTimeoutValue] = useState("300");

  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeTimeout, setResumeTimeout] = useState("300");

  const [forkOpen, setForkOpen] = useState(false);
  const [forkCount, setForkCount] = useState("1");
  const [forkTimeout, setForkTimeout] = useState("");
  const [forkConfirmed, setForkConfirmed] = useState(false);

  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");

  const [networkOpen, setNetworkOpen] = useState(false);
  const [allowOut, setAllowOut] = useState(
    (sandbox.network?.allowOut ?? []).join("\n"),
  );
  const [denyOut, setDenyOut] = useState(
    (sandbox.network?.denyOut ?? []).join("\n"),
  );
  const [internetAccess, setInternetAccess] = useState<InternetAccess>(
    sandbox.allowInternetAccess === true
      ? "allow"
      : sandbox.allowInternetAccess === false
        ? "block"
        : "unchanged",
  );
  const [networkConfirmed, setNetworkConfirmed] = useState(false);

  const [killOpen, setKillOpen] = useState(false);

  const running = sandbox.state === "running";
  const paused = sandbox.state === "paused";
  const plannedForks = positiveInteger(forkCount);

  async function withBusy(key: string, work: () => Promise<void>) {
    if (busy) {
      return;
    }
    setBusy(key);
    try {
      await work();
    } finally {
      setBusy(null);
    }
  }

  function handlePause() {
    void withBusy("pause", async () => {
      const result = await pauseSandboxAction(sandbox.sandboxID);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sandbox paused.");
      router.refresh();
    });
  }

  function handleResume() {
    const timeout = positiveInteger(resumeTimeout);
    if (timeout === null) {
      toast.error("Timeout must be a whole number of seconds.");
      return;
    }
    void withBusy("resume", async () => {
      const result = await resumeSandboxAction(sandbox.sandboxID, timeout);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setResumeOpen(false);
      toast.success("Sandbox resumed.");
      router.refresh();
    });
  }

  function handleTimeout() {
    const timeout = positiveInteger(timeoutValue);
    if (timeout === null) {
      toast.error("Timeout must be a whole number of seconds.");
      return;
    }
    void withBusy("timeout", async () => {
      const result = await setSandboxTimeoutAction(sandbox.sandboxID, timeout);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTimeoutOpen(false);
      toast.success(`Expiration set to ${timeout}s from now.`);
      router.refresh();
    });
  }

  function handleFork() {
    const count = positiveInteger(forkCount);
    if (count === null || count < 1 || count > MAX_FORKS) {
      toast.error(`Fork count must be between 1 and ${MAX_FORKS}.`);
      return;
    }
    if (count > 1 && !forkConfirmed) {
      toast.error("Confirm that multiple sandboxes will be created.");
      return;
    }
    const timeout =
      forkTimeout.trim() === "" ? undefined : positiveInteger(forkTimeout);
    if (timeout === null) {
      toast.error("Fork timeout must be a whole number of seconds.");
      return;
    }

    void withBusy("fork", async () => {
      const result = await forkSandboxAction(sandbox.sandboxID, count, timeout);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { createdSandboxIDs, failures } = result.data;
      setForkOpen(false);
      setForkConfirmed(false);
      if (createdSandboxIDs.length === 0) {
        toast.error(`All ${failures.length} forks failed to start.`, {
          description: failures[0],
        });
      } else if (failures.length > 0) {
        toast.warning(
          `${createdSandboxIDs.length} of ${count} forks started.`,
          { description: failures[0] },
        );
      } else {
        toast.success(
          `${createdSandboxIDs.length} fork${createdSandboxIDs.length === 1 ? "" : "s"} started.`,
        );
      }
      router.refresh();
    });
  }

  function handleSnapshot() {
    void withBusy("snapshot", async () => {
      const result = await createSandboxSnapshotAction(
        sandbox.sandboxID,
        snapshotName.trim() || undefined,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSnapshotOpen(false);
      setSnapshotName("");
      toast.success("Snapshot created.", {
        description: result.data.snapshotID,
      });
      router.refresh();
    });
  }

  function handleNetwork() {
    if (!networkConfirmed) {
      toast.error("Confirm that the current egress rules will be replaced.");
      return;
    }
    const update: SandboxNetworkUpdate = {};
    const allow = parseCommaSeparated(allowOut);
    const deny = parseCommaSeparated(denyOut);
    if (allow.length > 0) {
      update.allowOut = allow;
    }
    if (deny.length > 0) {
      update.denyOut = deny;
    }
    if (internetAccess !== "unchanged") {
      update.allow_internet_access = internetAccess === "allow";
    }

    void withBusy("network", async () => {
      const result = await updateSandboxNetworkAction(
        sandbox.sandboxID,
        update,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNetworkOpen(false);
      setNetworkConfirmed(false);
      toast.success("Network configuration replaced.");
      router.refresh();
    });
  }

  function handleKill() {
    void withBusy("kill", async () => {
      const result = await killSandboxAction(sandbox.sandboxID);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setKillOpen(false);
      toast.success("Sandbox killed.");
      router.push("/sandboxes");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => {
          router.refresh();
          toast.info("Refreshed.");
        }}
      >
        <RefreshCwIcon />
        Refresh
      </Button>

      {running ? (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={handlePause}
          >
            <PauseIcon />
            {busy === "pause" ? "Pausing…" : "Pause"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => setTimeoutOpen(true)}
          >
            <TimerIcon />
            Set timeout
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => setForkOpen(true)}
          >
            <CopyPlusIcon />
            Fork
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => setSnapshotOpen(true)}
          >
            <CameraIcon />
            Snapshot
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => setNetworkOpen(true)}
          >
            <NetworkIcon />
            Network
          </Button>
        </>
      ) : null}

      {paused ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => setResumeOpen(true)}
        >
          <PlayIcon />
          Resume
        </Button>
      ) : null}

      <Button
        variant="destructive"
        size="sm"
        disabled={busy !== null}
        onClick={() => setKillOpen(true)}
      >
        <Trash2Icon />
        Kill
      </Button>

      <Dialog open={timeoutOpen} onOpenChange={setTimeoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set timeout</DialogTitle>
            <DialogDescription>
              The sandbox expires this many seconds from now. Each call resets
              the countdown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="timeout-seconds">Timeout (seconds)</Label>
            <Input
              id="timeout-seconds"
              inputMode="numeric"
              value={timeoutValue}
              onChange={(event) => setTimeoutValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTimeoutOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button onClick={handleTimeout} disabled={busy !== null}>
              {busy === "timeout" ? "Saving…" : "Set timeout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume sandbox</DialogTitle>
            <DialogDescription>
              Resumes through the connect endpoint, which restores the paused VM
              and extends its time to live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resume-timeout">Timeout (seconds)</Label>
            <Input
              id="resume-timeout"
              inputMode="numeric"
              value={resumeTimeout}
              onChange={(event) => setResumeTimeout(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResumeOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button onClick={handleResume} disabled={busy !== null}>
              {busy === "resume" ? "Resuming…" : "Resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forkOpen} onOpenChange={setForkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fork sandbox</DialogTitle>
            <DialogDescription>
              This sandbox is briefly paused and snapshotted in place, then the
              forks boot from that snapshot. Its own ID and expiration are
              unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fork-count">Forks (1–{MAX_FORKS})</Label>
              <Input
                id="fork-count"
                inputMode="numeric"
                value={forkCount}
                onChange={(event) => setForkCount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fork-timeout">Fork timeout (seconds)</Label>
              <Input
                id="fork-timeout"
                inputMode="numeric"
                value={forkTimeout}
                onChange={(event) => setForkTimeout(event.target.value)}
                placeholder="inherit source"
              />
            </div>
          </div>
          {plannedForks !== null && plannedForks > 1 ? (
            <label className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 text-sm">
              <Checkbox
                checked={forkConfirmed}
                onCheckedChange={(checked) => setForkConfirmed(checked === true)}
                className="mt-0.5"
              />
              <span>
                Create {plannedForks} new sandboxes. Each one consumes the same
                CPU and memory as this sandbox.
              </span>
            </label>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setForkOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button onClick={handleFork} disabled={busy !== null}>
              {busy === "fork" ? "Forking…" : "Fork"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create snapshot</DialogTitle>
            <DialogDescription>
              Persists the current sandbox state as a snapshot that outlives
              this sandbox. Reusing a name adds a build to that snapshot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="snapshot-name">Name (optional)</Label>
            <Input
              id="snapshot-name"
              value={snapshotName}
              onChange={(event) => setSnapshotName(event.target.value)}
              placeholder="my-snapshot"
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSnapshotOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button onClick={handleSnapshot} disabled={busy !== null}>
              {busy === "snapshot" ? "Snapshotting…" : "Create snapshot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={networkOpen} onOpenChange={setNetworkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Replace network configuration</DialogTitle>
            <DialogDescription>
              The current egress rules are replaced wholesale — anything left
              blank here is cleared on the sandbox.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="network-allow">Allow egress to</Label>
              <Textarea
                id="network-allow"
                value={allowOut}
                onChange={(event) => setAllowOut(event.target.value)}
                placeholder={"8.8.8.8/32\n*.example.com"}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="network-deny">Deny egress to</Label>
              <Textarea
                id="network-deny"
                value={denyOut}
                onChange={(event) => setDenyOut(event.target.value)}
                placeholder="10.0.0.0/8"
                rows={3}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Internet access</Label>
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
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 text-sm">
              <Checkbox
                checked={networkConfirmed}
                onCheckedChange={(checked) =>
                  setNetworkConfirmed(checked === true)
                }
                className="mt-0.5"
              />
              <span>Replace the sandbox&apos;s current egress rules.</span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNetworkOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button onClick={handleNetwork} disabled={busy !== null}>
              {busy === "network" ? "Applying…" : "Replace rules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={killOpen} onOpenChange={setKillOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <TriangleAlertIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Kill this sandbox?</AlertDialogTitle>
            <AlertDialogDescription>
              The VM is destroyed immediately and its unsnapshotted state is
              lost. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleKill}
              disabled={busy !== null}
            >
              {busy === "kill" ? "Killing…" : "Kill sandbox"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
