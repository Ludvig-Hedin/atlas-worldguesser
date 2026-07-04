"use client";

import { useCallback, useRef, useState } from "react";
import { Lightbulb, Map as MapIcon, MapPin, Maximize2, Minimize2, Minus } from "lucide-react";
import { GuessMap, type HintCircle } from "./guess-map";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHasKeyboard } from "@/hooks/use-has-keyboard";
import type { LatLng } from "@/lib/types";
import { clamp } from "@/lib/math";

interface MapSheetProps {
  guess: LatLng | null;
  onGuess: (g: LatLng) => void;
  onSubmit: () => void;
  submitting: boolean;
  initialView: [number, number, number];
  onHint?: () => void;
  hintUsed?: boolean;
  hintCircle?: HintCircle | null;
}

const MIN_W = 240;
const MIN_H = 170;

export function MapSheet({
  guess,
  onGuess,
  onSubmit,
  submitting,
  initialView,
  onHint,
  hintUsed,
  hintCircle,
}: MapSheetProps) {
  const hasKeyboard = useHasKeyboard();
  const [fullscreen, setFullscreen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [size, setSize] = useState(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
    const vh = typeof window !== "undefined" ? window.innerHeight : 768;
    return { w: Math.min(360, Math.round(vw * 0.9)), h: Math.min(260, Math.round(vh * 0.4)) };
  });
  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      drag.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [size],
  );
  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const dw = drag.current.x - e.clientX; // drag left → wider (anchored right)
    const dh = drag.current.y - e.clientY; // drag up → taller (anchored bottom)
    const maxW = window.innerWidth - 24;
    const maxH = window.innerHeight - 140;
    setSize({
      w: clamp(drag.current.w + dw, MIN_W, maxW),
      h: clamp(drag.current.h + dh, MIN_H, maxH),
    });
  }, []);
  const endResize = useCallback(() => {
    drag.current = null;
  }, []);

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-30">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="flex size-11 items-center justify-center rounded-full bg-hud text-foreground shadow-2 ring-1 ring-inset ring-border backdrop-blur-md transition hover:bg-hud-hover hover:ring-border-strong"
              aria-label="Show map"
            >
              <MapIcon className="size-4.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Show map</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      className={fullscreen ? "fixed inset-x-3 bottom-3 top-16 z-40" : "fixed bottom-4 right-4 z-30"}
      style={fullscreen ? undefined : { width: size.w }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-card shadow-3 relative">
        <div className="relative w-full" style={fullscreen ? { flex: 1 } : { height: size.h }}>
          <GuessMap guess={guess} onGuess={onGuess} initialView={initialView} interactive hintCircle={hintCircle} />

          <div className="absolute right-2 top-2 z-10 flex gap-1.5">
            {!fullscreen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    className="flex size-8 items-center justify-center rounded-lg bg-black/50 text-white/85 shadow-1 backdrop-blur-md transition-colors hover:bg-black/68"
                    aria-label="Collapse map"
                  >
                    <Minus className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Collapse map</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setFullscreen((f) => !f)}
                  className="flex size-8 items-center justify-center rounded-lg bg-black/50 text-white/85 shadow-1 backdrop-blur-md transition-colors hover:bg-black/68"
                  aria-label={fullscreen ? "Shrink map" : "Expand map"}
                >
                  {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{fullscreen ? "Shrink map" : "Expand map"}</TooltipContent>
            </Tooltip>
          </div>

          {!fullscreen && (
            <div
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              className="absolute left-0 top-0 z-10 flex size-10 cursor-nwse-resize touch-none items-start justify-start p-1.5"
              aria-label="Resize map"
              role="separator"
            >
              <span className="size-3 rounded-tl-md border-l-2 border-t-2 border-white/70" />
            </div>
          )}

          {!guess && (
            <div className="pointer-events-none absolute left-2 top-2 flex justify-center px-2">
              <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/80 shadow-1 backdrop-blur-md">
                <MapPin className="size-3" />
                Click the map to place your guess
              </span>
            </div>
          )}
        </div>

        <div className="flex h-14 shrink-0 items-center gap-2 p-2 absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/30 to-black/0 w-full">
          <div className="bg-black/10 backdrop-blur-lg rounded-full">
          {onHint && (
            <Button
              variant="secondary"
              size="md"
              className="px-3"
              disabled={hintUsed}
              onClick={onHint}
              aria-label="Reveal a hint"
            >
              <Lightbulb className="size-4" />
              Hint
            </Button>
          )}
          </div>
         <div className="bg-black/10 backdrop-blur-lg flex-1 rounded-full flex items-center justify-center">
            <Button className="flex-1" size="md" disabled={!guess || submitting} onClick={onSubmit}>
            {guess ? "Guess" : "Place a pin"}
            {guess && hasKeyboard && (
              <Kbd className="ml-1 border-white/20 bg-black/20 text-primary-foreground/80">Space</Kbd>
            )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
