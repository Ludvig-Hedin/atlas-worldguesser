"use client";

import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";

/** A compact chip used for pointer-driven actions (e.g. clicking the map). */
function ActionChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded border border-border bg-white/5 px-1.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

const SHORTCUTS: { keys: React.ReactNode; label: string }[] = [
  { keys: <Kbd>Space</Kbd>, label: "Place / submit guess & advance" },
  { keys: <Kbd>Enter</Kbd>, label: "Next round" },
  {
    keys: (
      <>
        <Kbd>+</Kbd>
        <Kbd>−</Kbd>
      </>
    ),
    label: "Zoom in / out",
  },
  { keys: <ActionChip>Click map</ActionChip>, label: "Drop your pin" },
];

/** HUD icon button that opens a dialog listing the game's keyboard shortcuts. */
export function KeyboardLegend() {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white/90 shadow-1 backdrop-blur-md transition-colors hover:bg-black/68 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Keyboard className="size-4" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Shortcuts</TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move through rounds without touching the mouse.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-foreground/85">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">{s.keys}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
