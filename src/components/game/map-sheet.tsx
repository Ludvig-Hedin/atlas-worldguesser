"use client";

import { useState } from "react";
import { Maximize2, Minimize2, MapPin } from "lucide-react";
import { GuessMap } from "./guess-map";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { LatLng } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MapSheetProps {
  guess: LatLng | null;
  onGuess: (g: LatLng) => void;
  onSubmit: () => void;
  submitting: boolean;
  initialView: [number, number, number];
  pinned: boolean;
  onTogglePinned: () => void;
}

export function MapSheet({
  guess,
  onGuess,
  onSubmit,
  submitting,
  initialView,
  pinned,
  onTogglePinned,
}: MapSheetProps) {
  const [hover, setHover] = useState(false);
  const expanded = hover || pinned;

  return (
    <div
      className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border-strong bg-card shadow-2xl transition-[width,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          expanded
            ? "h-[48vh] w-[90vw] sm:h-[440px] sm:w-[560px]"
            : "h-[132px] w-[210px] sm:h-[168px] sm:w-[268px]",
        )}
      >
        <div className="relative h-[calc(100%-56px)]">
          <GuessMap guess={guess} onGuess={onGuess} initialView={initialView} interactive />
          <button
            type="button"
            onClick={onTogglePinned}
            className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-lg bg-black/50 text-white/80 backdrop-blur transition-colors hover:bg-black/70"
            aria-label={pinned ? "Collapse map" : "Expand map"}
          >
            {pinned ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          {!guess && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
              <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/75 backdrop-blur">
                <MapPin className="size-3" />
                Click the map to place your guess
              </span>
            </div>
          )}
        </div>
        <div className="flex h-[56px] items-center gap-2 p-2">
          <Button
            className="flex-1"
            size="md"
            disabled={!guess || submitting}
            onClick={onSubmit}
          >
            {guess ? "Guess" : "Place a pin"}
            {guess && <Kbd className="ml-1 border-white/20 bg-black/20 text-primary-foreground/80">Space</Kbd>}
          </Button>
        </div>
      </div>
    </div>
  );
}
