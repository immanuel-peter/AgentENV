"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
  size?: "icon-xs" | "icon-sm" | "icon";
};

export function CopyButton({
  value,
  label = "identifier",
  className,
  size = "icon-xs",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`Could not copy ${label} to the clipboard.`);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={`Copy ${label}`}
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
