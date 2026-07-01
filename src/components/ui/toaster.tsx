"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!bg-popover !border-border !text-popover-foreground !rounded-xl !shadow-2xl",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-white/8 !text-foreground",
        },
      }}
    />
  );
}
