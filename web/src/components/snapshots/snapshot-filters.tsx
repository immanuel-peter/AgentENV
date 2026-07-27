"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SnapshotFilterValues = {
  name: string;
  sandboxID: string;
};

/**
 * `GET /snapshots` filters server-side, so the values live in the URL and every
 * change re-runs the page's data fetch.
 */
export function SnapshotFilters({ initial }: { initial: SnapshotFilterValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);

  const dirty = values.name !== "" || values.sandboxID !== "";

  function apply(next: SnapshotFilterValues) {
    const query = new URLSearchParams();
    if (next.name.trim()) {
      query.set("name", next.name.trim());
    }
    if (next.sandboxID.trim()) {
      query.set("sandboxID", next.sandboxID.trim());
    }
    const search = query.toString();
    startTransition(() => {
      router.push(search ? `/snapshots?${search}` : "/snapshots");
    });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        apply(values);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="snapshot-name" className="text-xs text-muted-foreground">
          Name or ID
        </Label>
        <Input
          id="snapshot-name"
          value={values.name}
          placeholder="my-snapshot or my-snapshot:v1"
          className="w-64"
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
        />
      </div>

      <div className="grid gap-1.5">
        <Label
          htmlFor="snapshot-sandbox"
          className="text-xs text-muted-foreground"
        >
          Source sandbox ID
        </Label>
        <Input
          id="snapshot-sandbox"
          value={values.sandboxID}
          placeholder="Sandbox the snapshot was captured from"
          className="w-72"
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              sandboxID: event.target.value,
            }))
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          <SearchIcon />
          Apply
        </Button>
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const cleared = { name: "", sandboxID: "" };
              setValues(cleared);
              apply(cleared);
            }}
          >
            <XIcon />
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
