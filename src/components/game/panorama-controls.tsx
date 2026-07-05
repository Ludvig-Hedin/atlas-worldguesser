"use client";

import { Minus, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PanoramaControlsProps {
  /** Current view heading in degrees clockwise from north. */
  headingDeg: number;
  /** Reset the view to face north. Omit to render the compass non-interactive. */
  onResetNorth?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  showZoom?: boolean;
}

/** Bottom-left compass (tap to face north) + zoom controls. */
export function PanoramaControls({
  headingDeg,
  onResetNorth,
  onZoomIn,
  onZoomOut,
  showZoom = true,
}: PanoramaControlsProps) {
  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-col items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onResetNorth}
            disabled={!onResetNorth}
            aria-label="Face north"
            className="flex size-11 items-center justify-center rounded-full bg-hud text-foreground shadow-2 ring-1 ring-inset ring-border backdrop-blur-md transition hover:bg-hud-hover hover:ring-border-strong disabled:cursor-default disabled:ring-0 disabled:hover:bg-hud disabled:hover:ring-0"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              style={{ transform: `rotate(${-headingDeg}deg)` }}
            >
              <path d="M12 3 L15 12 L12 10 L9 12 Z" fill="#ff453a" />
              <path d="M12 21 L9 12 L12 14 L15 12 Z" fill="#e5e5ea" />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Face north</TooltipContent>
      </Tooltip>

      {showZoom && (
        <div className="flex flex-col overflow-hidden rounded-full bg-hud text-foreground shadow-2 backdrop-blur-md">
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            className="flex size-9 items-center justify-center transition-colors hover:bg-overlay-hover active:bg-overlay-strong"
          >
            <Plus className="size-4" />
          </button>
          <span className="mx-auto h-px w-5 bg-border-strong" />
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            className="flex size-9 items-center justify-center transition-colors hover:bg-overlay-hover active:bg-overlay-strong"
          >
            <Minus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
