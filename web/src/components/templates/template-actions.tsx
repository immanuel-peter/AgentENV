"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HammerIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteTemplateAction } from "@/app/(console)/templates/actions";

export type RebuildDefaults = {
  name?: string;
  cpuCount?: number;
  memoryMB?: number;
};

/**
 * The base is pinned to the template ID rather than its name: a rebuild keeps
 * the same name, so an alias would resolve ambiguously once the new template
 * claims it.
 */
function rebuildHref(templateID: string, defaults: RebuildDefaults): string {
  const query = new URLSearchParams({
    rebuildFrom: templateID,
    fromTemplate: templateID,
  });
  if (defaults.name) {
    query.set("name", defaults.name);
  }
  if (typeof defaults.cpuCount === "number") {
    query.set("cpuCount", String(defaults.cpuCount));
  }
  if (typeof defaults.memoryMB === "number") {
    query.set("memoryMB", String(defaults.memoryMB));
  }
  return `/templates/new?${query.toString()}`;
}

export function TemplateActions({
  templateID,
  label,
  rebuildDefaults,
}: {
  templateID: string;
  /** Human-readable name used in the delete confirmation. */
  label: string;
  rebuildDefaults: RebuildDefaults;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();

  function remove() {
    startDelete(async () => {
      const result = await deleteTemplateAction(templateID);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirming(false);
      toast.success(`Deleted ${label}.`);
      router.push("/templates");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        nativeButton={false}
        render={
          <Link
            href={`/sandboxes/new?fromTemplate=${encodeURIComponent(templateID)}`}
          />
        }
      >
        <PlayIcon />
        Create sandbox
      </Button>

      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={rebuildHref(templateID, rebuildDefaults)} />}
      >
        <HammerIcon />
        Rebuild
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogTrigger render={<Button variant="destructive" />}>
          <Trash2Icon />
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template and its published snapshot. Sandboxes
              already running from it keep running, but new ones can no longer
              be created. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={remove}>
              {deleting ? "Deleting…" : "Delete template"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
