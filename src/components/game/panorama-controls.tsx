"use client";

import { Minus, Plus } from "lucide-react";

interface PanoramaControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  showZoom?: boolean;
}

/** Zoom controls for a panorama (compass lives in the top CompassStrip). */
export function PanoramaControls({ onZoomIn, onZoomOut, showZoom = true }: PanoramaControlsProps) {
  if (!showZoom) return null;
  return (
    <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col overflow-hidden rounded-full bg-black/55 text-white shadow-lg backdrop-blur">
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
  );
}
