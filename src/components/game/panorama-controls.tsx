"use client";

import { Minus, Plus } from "lucide-react";

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
      <button
        type="button"
        onClick={onResetNorth}
        disabled={!onResetNorth}
        aria-label="Face north"
        className="flex size-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur transition-colors hover:bg-black/70 disabled:cursor-default disabled:hover:bg-black/55"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          style={{ transform: `rotate(${-headingDeg}deg)`, transition: "transform 120ms linear" }}
        >
          <path d="M12 3 L15 12 L12 10 L9 12 Z" fill="#ff453a" />
          <path d="M12 21 L9 12 L12 14 L15 12 Z" fill="#e5e5ea" />
        </svg>
      </button>

      {showZoom && (
        <div className="flex flex-col overflow-hidden rounded-full bg-black/55 text-white shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            className="flex size-9 items-center justify-center transition-colors hover:bg-white/15"
          >
            <Plus className="size-4" />
          </button>
          <span className="mx-auto h-px w-5 bg-white/20" />
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            className="flex size-9 items-center justify-center transition-colors hover:bg-white/15"
          >
            <Minus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
